// Función de login
async function login(username, password) {
    const formData = new FormData();
    formData.append('action', 'login');
    formData.append('username', username);
    formData.append('password', password);

    try {
        const response = await fetch('/api/', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            window.location.href = '/frontend.html';
        } else {
            alert('Error de login');
        }
    } catch (error) {
        console.error('Error:', error);
    }
} 