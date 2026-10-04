// A red star after a question name, for compulsory questions.
function Required() {
  return (
    <span className="req" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

export default Required;
