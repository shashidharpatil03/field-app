import { fullName } from "./farmerRules.js";

// First, middle and last name, with the full name shown underneath. The
// full name is worked out from the three, it is never typed in.
function NameFields({ first, middle, last, onChange, errors, idPrefix }) {
  function field(key, label, value, errorKey) {
    return (
      <div className="field">
        <label htmlFor={`${idPrefix}-${key}`}>{label}</label>
        <input
          id={`${idPrefix}-${key}`}
          type="text"
          value={value}
          onChange={(e) => onChange(key, e.target.value)}
          className={errors[errorKey] ? "has-error" : ""}
        />
        {errors[errorKey] && <p className="error">{errors[errorKey]}</p>}
      </div>
    );
  }

  const name = fullName(first, middle, last);
  return (
    <div>
      {field("first", "First name", first, "first_name")}
      {field("middle", "Middle name (optional)", middle, "middle_name")}
      {field("last", "Last name", last, "last_name")}
      <p className="full-name-line">
        Farmer name: <strong>{name || "-"}</strong>
      </p>
    </div>
  );
}

export default NameFields;
