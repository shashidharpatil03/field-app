// Answers the app's questions from the saved copy instead of the server.
// Every answer has the same shape the server would give, so the screens do
// not know the difference. The rules here (who is "Still to update", what
// the dashboard counts) are the same as on the server.

function matchesSeason(farmer, keys) {
  return keys.some((key) =>
    key === "this_year"
      ? farmer.season_status === "new" || farmer.season_status === "continued"
      : farmer.season_status === key,
  );
}

// Who is on the list, after the filters the screens send.
function filterFarmers(snapshot, params) {
  const lgs = {};
  for (const lg of snapshot.lgs) {
    lgs[lg.id] = lg;
  }
  const lgId = params.get("lg_id");
  const villageId = params.get("village_id");
  const ffId = params.get("ff_id");
  const gender = params.get("gender");
  const growing = params.get("growing");
  const water = params.get("water");
  const status = params.get("status") || "continuing";
  const keys = (params.get("season") || "").split(",").filter((k) => k !== "");
  const text = (params.get("q") || "").trim().toLowerCase();

  return snapshot.farmers.filter((f) => {
    if (lgId && String(f.lg_id) !== lgId) return false;
    if (villageId && String(f.village_id) !== villageId) return false;
    if (ffId && String(lgs[f.lg_id]?.ff_id) !== ffId) return false;
    if (gender && f.gender !== gender) return false;
    if (growing === "yes" && f.growing_cotton !== 1) return false;
    if (growing === "no" && f.growing_cotton !== 0) return false;
    if (water === "none" && f.water_regime !== null) return false;
    if (water && water !== "none" && f.water_regime !== water) return false;
    if (keys.length > 0) {
      if (!matchesSeason(f, keys)) return false;
    } else if (status !== "all" && f.participation !== status) {
      return false;
    }
    if (text !== "") {
      const haystack = `${f.name}\n${f.mobile ?? ""}\n${f.farmer_code}`;
      if (!haystack.toLowerCase().includes(text)) return false;
    }
    return true;
  });
}

function farmerList(snapshot, params) {
  const status = params.get("status") || "continuing";
  const season = params.get("season") || "";
  if (status === "deleted" && season === "") {
    // Deleted farmers are not kept on the phone.
    return { total: 0, items: [] };
  }
  const limit = Math.max(1, Math.min(Number(params.get("limit") || 40), 100));
  const offset = Math.max(0, Number(params.get("offset") || 0));
  const all = filterFarmers(snapshot, params);
  const items = all.slice(offset, offset + limit).map((f) => ({
    id: f.id,
    farmer_code: f.farmer_code,
    name: f.name,
    gender: f.gender,
    growing_cotton: f.growing_cotton,
    participation: f.participation,
    mobile: f.mobile,
    lg_id: f.lg_id,
    lg_code: f.lg_code,
    village: f.village,
    season_status: f.season_status,
  }));
  return { total: all.length, items };
}

function count(farmers, ...statuses) {
  return farmers.filter((f) => statuses.includes(f.season_status)).length;
}

// The groups, with the counts worked out from the farmers on the phone, so
// they stay right after a change made without signal.
function lgList(snapshot) {
  return snapshot.lgs.map((lg) => {
    const farmers = snapshot.farmers.filter((f) => f.lg_id === lg.id);
    return {
      ...lg,
      farmer_count: farmers.filter((f) => f.participation === "continuing")
        .length,
      draft_count: snapshot.drafts.filter((d) => d.lg_id === lg.id).length,
      season_total: count(farmers, "continued", "dropped", "to_update"),
      season_done: count(farmers, "continued", "dropped"),
      season_continued: count(farmers, "continued"),
      season_dropped: count(farmers, "dropped"),
      new_count: count(farmers, "new"),
      to_update_count: count(farmers, "to_update"),
      season_farmers: count(farmers, "new", "continued"),
    };
  });
}

function dashboard(snapshot, params) {
  const all = filterFarmers(
    snapshot,
    new URLSearchParams({
      status: "all",
      ...Object.fromEntries(
        ["lg_id", "village_id", "ff_id"]
          .filter((k) => params.get(k))
          .map((k) => [k, params.get(k)]),
      ),
    }),
  );
  const here = all.filter(
    (f) => f.season_status === "new" || f.season_status === "continued",
  );
  const sum = (key) => here.reduce((total, f) => total + (f[key] || 0), 0);
  const water = (name) => here.filter((f) => f.water_regime === name).length;
  const women = here.filter((f) => f.gender === "Female").length;
  const men = here.filter((f) => f.gender === "Male").length;
  const growing = sum("growing_cotton");
  const round = (n) => Math.round(n * 10) / 10;
  return {
    season: snapshot.season,
    this_year: {
      total: here.length,
      continued: count(all, "continued"),
      new: count(all, "new"),
      growing_cotton: growing,
      women: women,
      men: men,
      other_gender: here.length - women - men,
      not_growing: here.length - growing,
      water: {
        Rainfed: water("Rainfed"),
        "Partially irrigated": water("Partially irrigated"),
        "Fully irrigated": water("Fully irrigated"),
        none: here.filter((f) => f.water_regime === null).length,
      },
      area_under_cotton: round(sum("area_under_cotton")),
      total_landholding: round(sum("total_landholding")),
    },
    last_year: {
      total: count(all, "continued", "dropped", "to_update"),
      continued: count(all, "continued"),
      dropped: count(all, "dropped"),
      to_update: count(all, "to_update"),
    },
  };
}

// Returns { status, body } for a question the saved copy can answer, or
// null when it cannot (the app then asks the server).
export function answerLocal(snapshot, path, params) {
  if (path === "/lgs") {
    return { status: 200, body: lgList(snapshot) };
  }
  if (path === "/farmers") {
    return { status: 200, body: farmerList(snapshot, params) };
  }
  if (path === "/farmers/dashboard") {
    return { status: 200, body: dashboard(snapshot, params) };
  }
  if (path === "/drafts") {
    return { status: 200, body: snapshot.drafts };
  }
  if (path === "/sent") {
    return { status: 200, body: snapshot.sent };
  }
  const one = path.match(/^\/farmers\/(-?\d+)(\/changes)?$/);
  if (one) {
    const farmer = snapshot.farmers.find((f) => f.id === Number(one[1]));
    if (!farmer) {
      return { status: 404, body: { detail: "Farmer not found" } };
    }
    if (one[2]) {
      return { status: 200, body: snapshot.changes[String(farmer.id)] ?? [] };
    }
    return { status: 200, body: farmer };
  }
  return null;
}
