document.getElementById("logoutBtn").addEventListener("click", () => {
  // Clear JWT tokens
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");

  // Optional: clear all localStorage items
  // localStorage.clear();

  // Redirect to login page
  window.location.href = "index.html";
});
