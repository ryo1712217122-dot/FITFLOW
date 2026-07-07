// FITFLOW - トースト通知・確認モーダル

function showToast(message) {
    if (!DOM.toast) return;
    DOM.toast.querySelector('.toast-message').textContent = message;
    DOM.toast.classList.remove('hidden');

    setTimeout(() => {
        DOM.toast.classList.add('hidden');
    }, 3000);
}

function showConfirmModal(title, message, onConfirm) {
    if (!DOM.confirmModal) return;
    DOM.modalTitle.textContent = title;
    DOM.modalMessage.textContent = message;
    DOM.confirmModal.classList.remove('hidden');

    const newConfirmBtn = DOM.modalConfirmBtn.cloneNode(true);
    const newCancelBtn = DOM.modalCancelBtn.cloneNode(true);
    DOM.modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, DOM.modalConfirmBtn);
    DOM.modalCancelBtn.parentNode.replaceChild(newCancelBtn, DOM.modalCancelBtn);

    DOM.modalConfirmBtn = newConfirmBtn;
    DOM.modalCancelBtn = newCancelBtn;

    DOM.modalConfirmBtn.addEventListener('click', () => {
        DOM.confirmModal.classList.add('hidden');
        onConfirm();
    });

    DOM.modalCancelBtn.addEventListener('click', () => {
        DOM.confirmModal.classList.add('hidden');
    });
}
