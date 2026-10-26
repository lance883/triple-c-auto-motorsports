"use strict";
const form = document.getElementById("credit-form");
const fields = document.getElementById("application-fields");
const statusBox = document.getElementById("form-status");
const button = document.getElementById("submit-button");
const joint = document.getElementById("joint");
let token;
function toggleJoint() {
  document.getElementById("joint-section").hidden = !joint.checked;
  document.getElementById("joint-fields").disabled = !joint.checked;
  document.getElementById("joint-signature").hidden = !joint.checked;
  document.getElementById("joint-signature").disabled = !joint.checked;
}
joint.addEventListener("change", toggleJoint);
toggleJoint();
async function initialize() {
  try {
    const response = await fetch("/api/credit-application", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.ready) throw new Error("unavailable");
    token = result.token;
    fields.disabled = false;
    statusBox.textContent = "Complete the application below, then select Submit application. Your application will be emailed directly to the dealership.";
  } catch {
    statusBox.textContent = "Online applications are temporarily unavailable. Please call (870) 291-9233 for assistance. No information has been submitted.";
  }
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!token || button.disabled || !form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form));
  button.disabled = true;
  button.textContent = "Sending application…";
  fields.disabled = true;
  statusBox.textContent = "Sending your application. Please keep this page open.";
  try {
    const response = await fetch("/api/credit-application", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, values })
    });
    const result = await response.json();
    if (!response.ok) {
      if (result.code === "EXPIRED") {
        await initialize();
        throw new Error("Your session expired. Review your entries and select Submit application again.");
      }
      throw new Error(result.message || "We could not confirm delivery. Please call (870) 291-9233 before submitting again.");
    }
    form.reset();
    toggleJoint();
    form.hidden = true;
    token = null;
    statusBox.textContent = "Thank you. Your application has been sent to Triple C Auto & Motorsports. Reference: " + result.reference + ". Please call (870) 291-9233 with any questions.";
    statusBox.setAttribute("tabindex", "-1");
    statusBox.focus();
  } catch (error) {
    statusBox.textContent = error instanceof TypeError
      ? "We could not confirm delivery. Please call (870) 291-9233 before submitting again to avoid a duplicate application."
      : error.message;
    fields.disabled = false;
    toggleJoint();
    button.disabled = false;
    button.textContent = "Submit application";
  }
});
initialize();
