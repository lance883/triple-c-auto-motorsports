"use strict";
const joint = document.getElementById("joint");
const jointFields = document.getElementById("joint-fields");
const jointSignature = document.getElementById("joint-signature");
joint.addEventListener("change", () => {
  document.getElementById("joint-section").hidden = !joint.checked;
  jointFields.disabled = !joint.checked;
  jointSignature.hidden = !joint.checked;
  jointSignature.querySelectorAll("input").forEach(input => { input.disabled = !joint.checked; });
});
joint.dispatchEvent(new Event("change"));
document.querySelector("form").addEventListener("submit", event => event.preventDefault());
