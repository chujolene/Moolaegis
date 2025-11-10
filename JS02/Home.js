// Decode JWT (base64 decode)
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

if (!localStorage.getItem('access_token')) {
    window.location.href = 'login.html';
  }
else {
    const token = localStorage.getItem('access_token');
    if (token) {
        const decoded = parseJwt(token);
        document.getElementById('welcomeUsername').textContent = decoded.sub || 'User';
        } else {
        window.location.href = 'Main.html'; // Redirect if not logged in
    }

}
