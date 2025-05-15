/** @type {HTMLDialogElement} */
const dia = document.getElementById('login-prompt');
/** @type {HTMLInputElement} */
const email = document.getElementById('email');
/** @type {HTMLInputElement} */
const pass = document.getElementById('password');
/** @type {HTMLButtonElement} */
const login = document.getElementById('submit-login');
/** @type {HTMLDivElement} */
const form = document.getElementById('login-form');
/** @type {HTMLDivElement} */
const throber = document.getElementById('throber');
/** @type {HTMLSpanElement} */
const loginText = document.getElementById('login');
/** @type {HTMLSpanElement} */
const passText = document.getElementById('pass');
/** @type {HTMLDivElement} */
const error = document.getElementById('error');
/** @type {HTMLSpanElement} */
const message = document.getElementById('message');
/** @type {HTMLDialogElement} */
const loading = document.getElementById('loading-cover');
/** @type {HTMLSpanElement} */
const loadingLabel = document.getElementById('loading-label');
/** @type {HTMLDivElement} */
const tokenLogin = document.getElementById('login-with-token');
/** @type {HTMLButtonElement} */
const openTokenLogin = document.getElementById('view-token');
/** @type {HTMLInputElement} */
const tokenText = document.getElementById('token');
/** @type {HTMLButtonElement} */
const submitToken = document.getElementById('submit-token');
loading.showModal();

openTokenLogin.onclick = () => showTokenLogin();
submitToken.onclick = () => client.token = tokenText.value;

// dont remove the old token, we may have been kicked here for unrelated reasons
export function requireLogin(init = true) {
    form.hidden = false;
    throber.hidden = true;
    error.hidden = true;
    tokenLogin.hidden = true;
    dia.showModal();
}
function loginError(msg) {
    form.hidden = true;
    throber.hidden = true;
    error.hidden = false;
    tokenLogin.hidden = true;
    message.textContent = msg;
}
function showLoginThrober() {
    form.hidden = true;
    throber.hidden = false;
    error.hidden = true;
    tokenLogin.hidden = true;
}
function showTokenLogin() {
    form.hidden = true;
    throber.hidden = true;
    error.hidden = true;
    tokenLogin.hidden = false;
}
export function finishLoading() { loading.close() }
export function labelLoadingStage(label) { loadingLabel.innerText = label; }
if (!client.token) requireLogin();
login.onclick = async () => {
    showLoginThrober();
    const res = await client.fromApi('POST /auth/login', {
        login: email.value,
        password: pass.value,
        undelete: false
    }).catch(err => err);
    if (res.message) {
        requireLogin(false);
        loginText.textContent = res.message.errors.login
            ? `Email: ― ${res.message.errors.login._errors.map(error => error.message).join(', ')}`
            : 'Email:' 
        loginText.style.color = res.message.errors.login ? '#f11' : ''
        passText.textContent = res.message.errors.password
            ? `Password: ― ${res.message.errors.password._errors.map(error => error.message).join(', ')}`
            : 'Password:'
        passText.style.color = res.message.errors.password ? '#f11' : ''
        return;
    }
    if (res.captcha_key?.length) {
        loginError(`Invalid captcha service required by login, service requested: ${res.captcha_service}`);
        return;
    }
    if (!res.token) {
        loginError(`Invalid login response: ${JSON.stringify(res, null, 2)}`);
        return;
    }
    client.token = res.token;
}