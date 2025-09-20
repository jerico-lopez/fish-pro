document.addEventListener("DOMContentLoaded", function () {
  function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
  }

  // Wait until window.currentUser is set, then run instantly
  if (window.currentUser && Array.isArray(window.currentUser.permissions)) {
    setupNavigationPermissions();
    hideLoader();
  } else {
    // Poll until currentUser is available
    const interval = setInterval(() => {
      if (window.currentUser && Array.isArray(window.currentUser.permissions)) {
        setupNavigationPermissions();
        hideLoader();
        clearInterval(interval);
      }
    }, 50);
  }
});

function setupNavigationPermissions() {
  const navLinks = document.querySelectorAll(".nav-link[data-permission]");
  const userPerms = window.currentUser && Array.isArray(window.currentUser.permissions)
    ? window.currentUser.permissions
    : [];

  navLinks.forEach(link => {
    const permission = link.getAttribute("data-permission");
    if (!userPerms.includes(permission)) {
      link.style.display = "none";
    }
  });
}
