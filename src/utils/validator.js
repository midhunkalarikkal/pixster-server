export const validateUsername = (username) => {
    if (username === "") {
        return null;
    }

    if (username.length < 6 || username.length > 25) {
        return "Username must be between 6 and 25 characters";
    }

    const usernameRegex = /^[a-z0-9_.]+$/;
    if (!usernameRegex.test(username)) {
        return "Username can only contain small letters, numbers, and underscores";
    }

    return null;
};

export const validateFullName = (fullName) => {
    if (fullName === "") {
        return null;
    }

    if (fullName.length < 4 || fullName.length > 25) {
        return "Full name must be between 4 and 25 characters";
    }

    const fullNameRegex = /^[a-zA-Z\s]+$/;
    if (!fullNameRegex.test(fullName)) {
        return "Full name can only contain letters and spaces";
    }

    return null;
};

export const validateEmail = (email) => {
    if (email === "") {
        return null;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!emailRegex.test(email)) {
        return "Invalid email format";
    }

    return null;
};

export const validatePassword = (password) => {
    if (password === "") {
        return null;
    }

    if (password.length < 8 || password.length > 25) {
        return "Password must be between 8 and 25 characters";
    }

    if (!/[A-Z]/.test(password)) {
        return "Password must contain at least one uppercase letter";
    }

    if (!/[a-z]/.test(password)) {
        return "Password must contain at least one lowercase letter";
    }

    if (!/\d/.test(password)) {
        return "Password must contain at least one digit";
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        return "Password must contain at least one special character";
    }

    return null;
};

