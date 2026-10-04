// A panel that slides up from the bottom of the screen, over a dimmed page.
// Tapping the dim area closes it.
function Sheet({ title, onClose, children }) {
  return (
    <div className="bs-wrap">
      <div className="bs-dim" onClick={onClose} />
      <div
        className="bs-box"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3 className="bs-title">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default Sheet;
