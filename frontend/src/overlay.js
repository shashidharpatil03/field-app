// Puts the changes that are still waiting on the phone on top of the saved
// copy of the server's data, so lists, counts and the dashboard already show
// them. Nothing here is saved: it is worked out again whenever the waiting
// list or the saved copy changes. The rules (who counts as "Continued" after
// an edit, which history lines are written) follow the server's.

import { fullName } from "./farmerRules.js";

const STATUS_LABEL = { continuing: "Continuing", dropped_out: "Dropped out" };

// Today as "2026-10-04" in the phone's own time zone.
function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// "12.0" -> "12", like the server writes acres in the history.
function acres(value) {
  return value === null || value === undefined
    ? "(not recorded)"
    : String(Number(value));
}

// Adds history lines (oldest first) to the top of a farmer's history.
function addHistory(snapshot, farmerId, lines, item, me) {
  const rows = lines.map(([field, oldValue, newValue, reason], i) => ({
    id: `waiting-${item.key}-${i}`,
    field: field,
    old_value: oldValue,
    new_value: newValue,
    changed_on: today(),
    changed_at: new Date().toISOString().slice(0, 19) + "Z",
    reason: reason ?? "",
    changed_by_name: me.name,
  }));
  const old = snapshot.changes[String(farmerId)] ?? [];
  snapshot.changes[String(farmerId)] = [...rows.reverse(), ...old];
}

function applyEdit(snapshot, item, me) {
  const farmer = snapshot.farmers.find((f) => f.id === item.farmerId);
  if (!farmer) {
    return;
  }
  const body = item.body;
  const name = fullName(body.first_name, body.middle_name, body.last_name);
  const growing = body.growing_cotton ? 1 : 0;
  const total = body.total_landholding;
  const area = growing ? body.area_under_cotton : 0;
  const mobile = (body.mobile ?? "").trim();
  const reason = (body.reason ?? "").trim();

  const lines = [];
  if (farmer.name !== name) {
    lines.push(["Name", farmer.name, name, reason]);
  }
  if (farmer.gender !== body.gender) {
    lines.push(["Gender", farmer.gender, body.gender, reason]);
  }
  if (farmer.growing_cotton !== growing) {
    lines.push([
      "Growing cotton",
      farmer.growing_cotton ? "Yes" : "No",
      growing ? "Yes" : "No",
      reason,
    ]);
  }
  if ((farmer.mobile ?? "") !== mobile) {
    lines.push([
      "Mobile number",
      farmer.mobile || "(none)",
      mobile || "(none)",
      reason,
    ]);
  }
  if (farmer.total_landholding !== total) {
    lines.push([
      "Total landholding (acres)",
      acres(farmer.total_landholding),
      acres(total),
      reason,
    ]);
  }
  if (farmer.area_under_cotton !== area) {
    lines.push([
      "Area under cotton (acres)",
      acres(farmer.area_under_cotton),
      acres(area),
      reason,
    ]);
  }
  if (farmer.water_regime !== body.water_regime) {
    lines.push([
      "Water regime",
      farmer.water_regime || "(not recorded)",
      body.water_regime,
      reason,
    ]);
  }

  const wasStatus = farmer.season_status;
  const newParticipation = body.participation || farmer.participation;
  const participationChanged = newParticipation !== farmer.participation;
  let nextStatus = wasStatus;
  if (participationChanged) {
    nextStatus = newParticipation === "dropped_out" ? "dropped" : "continued";
    const why =
      newParticipation === "dropped_out"
        ? [body.drop_reason, reason].filter((p) => p).join(" - ")
        : reason;
    lines.push([
      "Participation",
      STATUS_LABEL[farmer.participation],
      STATUS_LABEL[newParticipation],
      why,
    ]);
  } else if (wasStatus === "to_update") {
    nextStatus = "continued";
  }
  // Saving without any change still counts as confirming the details.
  const confirmed =
    lines.filter((l) => l[0] !== "Participation").length === 0 &&
    ((participationChanged && newParticipation === "continuing") ||
      (!participationChanged && wasStatus === "to_update"));
  if (confirmed) {
    lines.push(["Confirmed", "", "Details confirmed", ""]);
  }
  addHistory(snapshot, farmer.id, lines, item, me);

  Object.assign(farmer, {
    name: name,
    first_name: body.first_name,
    middle_name: body.middle_name,
    last_name: body.last_name,
    gender: body.gender,
    growing_cotton: growing,
    mobile: mobile || null,
    total_landholding: total,
    area_under_cotton: area,
    water_regime: body.water_regime,
    participation: newParticipation,
    season_status: nextStatus,
    pending: true,
    pendingKey: item.key,
  });
}

function applyDelete(snapshot, item) {
  snapshot.farmers = snapshot.farmers.filter((f) => f.id !== item.farmerId);
  delete snapshot.changes[String(item.farmerId)];
}

// A form kept on the phone: either a draft, or a farmer waiting to be
// registered.
function applyForm(snapshot, item, me) {
  const lg = snapshot.lgs.find((l) => l.id === item.lgId);
  if (!lg) {
    return;
  }
  const data = item.data;
  const name = fullName(data.first_name, data.middle_name, data.last_name);

  if (!item.submit) {
    const draft = {
      id: item.draftId ?? item.localId,
      lg_id: lg.id,
      name: name,
      first_name: data.first_name,
      middle_name: data.middle_name,
      last_name: data.last_name,
      gender: data.gender,
      growing_cotton:
        data.growing_cotton === null ? null : data.growing_cotton ? 1 : 0,
      mobile: data.mobile,
      total_landholding: data.total_landholding,
      area_under_cotton: data.area_under_cotton,
      water_regime: data.water_regime,
      confirmed_large: data.confirmed_large ? 1 : 0,
      updated_at: item.savedAt.slice(0, 19),
      lg_code: lg.lg_code,
      village: lg.village,
      pending: true,
      pendingKey: item.key,
    };
    const at = snapshot.drafts.findIndex((d) => d.id === draft.id);
    if (at >= 0) {
      snapshot.drafts[at] = draft;
    } else {
      snapshot.drafts.unshift(draft);
    }
    return;
  }

  if (item.draftId !== null && item.draftId !== undefined) {
    snapshot.drafts = snapshot.drafts.filter((d) => d.id !== item.draftId);
  }
  const growing = data.growing_cotton ? 1 : 0;
  const lgNumber = Number(lg.lg_code.split("-")[1]);
  snapshot.farmers.push({
    id: item.localId,
    farmer_code: `${lg.lg_code}-NEW`,
    lg_code: lg.lg_code,
    lg_number: lgNumber,
    farmer_number: 100000 - item.localId / 1e12,
    lg_id: lg.id,
    name: name,
    first_name: data.first_name,
    middle_name: data.middle_name,
    last_name: data.last_name,
    gender: data.gender,
    growing_cotton: growing,
    mobile: data.mobile || null,
    participation: "continuing",
    total_landholding: data.total_landholding,
    area_under_cotton: growing ? data.area_under_cotton : 0,
    water_regime: data.water_regime,
    registered_on: today(),
    registered_by_name: me.name,
    village_id: lg.village_id,
    village: lg.village,
    pu_name: lg.pu_name,
    ff_name: lg.ff_name,
    season_status: "new",
    pending: true,
    pendingKey: item.key,
  });
}

function applyDraftDelete(snapshot, item) {
  snapshot.drafts = snapshot.drafts.filter((d) => d.id !== item.draftId);
}

// Returns a copy of the saved data with the waiting changes on top.
export function applyPending(saved, pending, me) {
  const snapshot = JSON.parse(JSON.stringify(saved));
  for (const item of pending) {
    if (item.kind === "edit") {
      applyEdit(snapshot, item, me);
    } else if (item.kind === "delete") {
      applyDelete(snapshot, item);
    } else if (item.kind === "draftDelete") {
      applyDraftDelete(snapshot, item);
    } else {
      applyForm(snapshot, item, me);
    }
  }
  snapshot.farmers.sort(
    (a, b) => a.lg_number - b.lg_number || a.farmer_number - b.farmer_number,
  );
  return snapshot;
}
