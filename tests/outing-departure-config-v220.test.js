const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");

function malaysiaParts(date) {
  const shifted = new Date(new Date(date).getTime() + (8 * 60 * 60 * 1000));
  const pad = (value) => String(value).padStart(2, "0");
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    hour: pad(shifted.getUTCHours()),
    minute: pad(shifted.getUTCMinutes())
  };
}

function createContext() {
  const properties = { OUTING_CONFIG_V2_ENABLED: "false" };
  const context = vm.createContext({
    console,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => Object.prototype.hasOwnProperty.call(properties, key) ? properties[key] : null
      })
    },
    SpreadsheetApp: {
      getActive: () => null,
      openById: () => ({ getSheetByName: () => null })
    },
    Session: { getScriptTimeZone: () => "Asia/Kuala_Lumpur" },
    Utilities: {
      formatDate: (date, timezone, format) => {
        assert.equal(timezone, "Asia/Kuala_Lumpur");
        const parts = malaysiaParts(date);
        if (format === "yyyy-MM-dd") return parts.date;
        if (format === "HH:mm") return `${parts.hour}:${parts.minute}`;
        if (format === "H") return String(Number(parts.hour));
        if (format === "m") return String(Number(parts.minute));
        return `${parts.date} ${parts.hour}:${parts.minute}:00`;
      }
    }
  });
  vm.runInContext(gasSource, context);
  return { context, properties };
}

function dateInContext(context, iso) {
  return vm.runInContext(`new Date(${JSON.stringify(iso)})`, context);
}

function departureConfig(context, overrides = {}) {
  return context.validateOutingTypeConfig_({
    type_code: "PULANG_BERMALAM",
    display_name: "Pulang Bermalam",
    description: "Ujian peraturan keluar.",
    active: true,
    sort_order: 4,
    allowed_days: "AHAD,ISNIN,SELASA,RABU,KHAMIS,JUMAAT,SABTU",
    application_open_time: "",
    application_close_time: "",
    departure_allowed_days: "JUMAAT",
    earliest_departure_time: "14:00",
    fixed_return_time: "",
    same_day_only: false,
    require_leave_date: false,
    require_return_date: false,
    require_return_time: false,
    require_guardian_phone: false,
    require_guardian_relation: false,
    require_emergency_reason: false,
    require_purpose: false,
    require_location: false,
    require_vehicle: false,
    require_warden_approval: true,
    require_selfie: true,
    ...overrides
  }, { requireTypeCode: true });
}

test("Pulang Bermalam application Monday through Thursday accepts a requested Friday departure", () => {
  const { context } = createContext();
  const config = departureConfig(context);
  for (const applicationIso of [
    "2026-08-03T02:00:00Z",
    "2026-08-04T02:00:00Z",
    "2026-08-05T02:00:00Z",
    "2026-08-06T02:00:00Z"
  ]) {
    const result = context.validateConfigDrivenSubmissionV200_(
      { tarikh: "2026-08-07" },
      config,
      dateInContext(context, applicationIso)
    );
    assert.equal(result.tarikh, "2026-08-07");
  }
});

test("configured Friday departure rejects another requested day and accepts Friday", () => {
  const { context } = createContext();
  const config = departureConfig(context);
  const monday = dateInContext(context, "2026-08-03T02:00:00Z");
  assert.throws(
    () => context.validateConfigDrivenSubmissionV200_({ tarikh: "2026-08-08" }, config, monday),
    /Pulang Bermalam hanya dibenarkan keluar pada hari Jumaat\./
  );
  assert.doesNotThrow(
    () => context.validateConfigDrivenSubmissionV200_({ tarikh: "2026-08-07" }, config, monday)
  );
});

test("real activation payload accepts Monday application for Friday leave with return and guardian fields", () => {
  const { context } = createContext();
  const config = departureConfig(context, {
    earliest_departure_time: "17:00",
    require_leave_date: true,
    require_return_date: true,
    require_return_time: true,
    require_guardian_phone: true,
    require_guardian_relation: true
  });
  const monday = dateInContext(context, "2026-08-10T02:00:00Z");
  const payload = {
    tarikh: "2026-08-14",
    tarikh_balik: "2026-08-16",
    masa_balik_dijangka: "20:30",
    telefon_waris: "0123456789",
    hubungan_waris: "Ibu"
  };
  const result = context.validateConfigDrivenSubmissionV200_(payload, config, monday);
  assert.equal(result.tarikh, "2026-08-14");
  assert.equal(result.tarikh_balik, "2026-08-16");
  assert.equal(result.masa_balik_dijangka, "20:30");
});

test("populated non-Friday leave date gets the dynamic day error, never a false required error", () => {
  const { context } = createContext();
  const config = departureConfig(context, { require_leave_date: true });
  const monday = dateInContext(context, "2026-08-10T02:00:00Z");
  assert.throws(
    () => context.validateConfigDrivenSubmissionV200_({ tarikh: "2026-08-15" }, config, monday),
    (error) => {
      assert.match(error.message, /Pulang Bermalam hanya dibenarkan keluar pada hari Jumaat\./);
      assert.doesNotMatch(error.message, /Tarikh keluar diperlukan/);
      return true;
    }
  );
});

test("multiple configured departure days are formatted safely", () => {
  const { context } = createContext();
  const config = departureConfig(context, { departure_allowed_days: "JUMAAT,SABTU" });
  const monday = dateInContext(context, "2026-08-10T02:00:00Z");
  assert.throws(
    () => context.validateConfigDrivenSubmissionV200_({ tarikh: "2026-08-16" }, config, monday),
    /Pulang Bermalam hanya dibenarkan keluar pada hari Jumaat atau Sabtu\./
  );
});

test("missing leave date, invalid return ordering and guardian requirements remain explicit", () => {
  const { context } = createContext();
  const config = departureConfig(context, {
    require_leave_date: true,
    require_return_date: true,
    require_return_time: true,
    require_guardian_phone: true,
    require_guardian_relation: true
  });
  const monday = dateInContext(context, "2026-08-10T02:00:00Z");
  assert.throws(
    () => context.validateConfigDrivenSubmissionV200_({}, config, monday),
    /Tarikh keluar diperlukan/
  );
  assert.throws(
    () => context.validateConfigDrivenSubmissionV200_({
      tarikh: "2026-08-14",
      tarikh_balik: "2026-08-13",
      masa_balik_dijangka: "20:30",
      telefon_waris: "0123456789",
      hubungan_waris: "Ibu"
    }, config, monday),
    /Tarikh pulang ke asrama tidak boleh lebih awal/
  );
  assert.throws(
    () => context.validateConfigDrivenSubmissionV200_({
      tarikh: "2026-08-14",
      tarikh_balik: "2026-08-16",
      masa_balik_dijangka: "20:30",
      hubungan_waris: "Ibu"
    }, config, monday),
    /Telefon waris diperlukan/
  );
});

test("application window and earliest departure time remain independent", () => {
  const { context } = createContext();
  const mondayMorning = dateInContext(context, "2026-08-03T02:00:00Z");
  const noApplicationLimit = departureConfig(context, { earliest_departure_time: "17:00" });
  assert.doesNotThrow(() => context.validateConfigDrivenSubmissionV200_(
    { tarikh: "2026-08-07" }, noApplicationLimit, mondayMorning
  ));

  const closedApplication = departureConfig(context, {
    application_open_time: "17:00",
    earliest_departure_time: "14:00"
  });
  assert.throws(
    () => context.validateConfigDrivenSubmissionV200_({ tarikh: "2026-08-07" }, closedApplication, mondayMorning),
    /belum dibuka atau telah ditutup/
  );
});

test("Guard departure enforcement uses the configured Friday time dynamically", () => {
  const { context } = createContext();
  const twoPm = departureConfig(context, { earliest_departure_time: "14:00" });
  const friday1359 = dateInContext(context, "2026-08-07T05:59:00Z");
  const friday1400 = dateInContext(context, "2026-08-07T06:00:00Z");
  assert.throws(
    () => context.validateGuardDepartureV220_({}, twoPm, friday1359),
    /2:00 Petang/
  );
  assert.doesNotThrow(() => context.validateGuardDepartureV220_({}, twoPm, friday1400));

  const fivePm = departureConfig(context, { earliest_departure_time: "17:00" });
  const friday1700 = dateInContext(context, "2026-08-07T09:00:00Z");
  assert.throws(
    () => context.validateGuardDepartureV220_({}, fivePm, friday1400),
    /5:00 Petang/
  );
  assert.doesNotThrow(() => context.validateGuardDepartureV220_({}, fivePm, friday1700));
});

test("Guard rejects confirmation before the approved departure date with a Malaysia-friendly date", () => {
  const { context } = createContext();
  const config = departureConfig(context, { earliest_departure_time: "17:00" });
  const monday = dateInContext(context, "2026-08-10T02:00:00Z");
  assert.throws(
    () => context.validateGuardDepartureV220_({ tarikh: "2026-08-14" }, config, monday),
    /Tarikh keluar yang diluluskan ialah 14 Ogos 2026\. Sahkan Keluar hanya boleh dibuat pada tarikh tersebut\./
  );
});

test("Guard cannot confirm an actual departure on a non-configured day", () => {
  const { context } = createContext();
  const config = departureConfig(context);
  const thursday = dateInContext(context, "2026-08-06T09:00:00Z");
  assert.throws(
    () => context.validateGuardDepartureV220_({}, config, thursday),
    /Pulang Bermalam hanya dibenarkan keluar pada hari Jumaat\./
  );
});

test("outing types without departure constraints keep existing behavior", () => {
  const { context } = createContext();
  const config = departureConfig(context, {
    type_code: "OUTING_BIASA",
    departure_allowed_days: "",
    earliest_departure_time: ""
  });
  const thursdayMorning = dateInContext(context, "2026-08-06T02:00:00Z");
  assert.doesNotThrow(() => context.validateGuardDepartureV220_({}, config, thursdayMorning));
});

test("legacy public behavior and feature flag remain off", () => {
  const { context, properties } = createContext();
  const publicRows = context.getOutingTypes();
  const overnight = publicRows.find((row) => row.type_code === "PULANG_BERMALAM");
  assert.equal(properties.OUTING_CONFIG_V2_ENABLED, "false");
  assert.equal(overnight.departure_allowed_days, "");
  assert.equal(overnight.earliest_departure_time, "");
  assert.doesNotMatch(gasSource, /setProperty\(OUTING_CONFIG_V2_PROPERTY,\s*"true"\)/);
});

test("confirmOut resolves and enforces departure configuration after existing Guard checks", () => {
  const source = gasSource.slice(
    gasSource.indexOf("function confirmOut(payload)"),
    gasSource.indexOf("function confirmIn(payload)")
  );
  const statusCheck = source.indexOf("found.record.status !== STATUS.approved");
  const resolver = source.indexOf("resolveSubmissionOutingTypeConfigV200_");
  const validator = source.indexOf("validateGuardDepartureV220_");
  assert.ok(statusCheck !== -1 && resolver > statusCheck && validator > resolver);
  assert.match(source, /findActiveGuard_/);
});
