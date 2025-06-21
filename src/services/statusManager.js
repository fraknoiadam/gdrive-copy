export class StatusManager {
  constructor() {
    this.container = document.getElementById('status-container');
    this.activeMessages = new Set();
  }

  show(message, type = 'info', duration = 5000) {
    const messageElement = this._createMessageElement(message, type);
    this.container.appendChild(messageElement);
    this.activeMessages.add(messageElement);

    // Auto-remove after duration
    setTimeout(() => {
      this.hide(messageElement);
    }, duration);

    return messageElement;
  }

  hide(messageElement) {
    if (this.activeMessages.has(messageElement)) {
      messageElement.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => {
        if (messageElement.parentNode) {
          messageElement.parentNode.removeChild(messageElement);
        }
        this.activeMessages.delete(messageElement);
      }, 300);
    }
  }

  clear() {
    this.activeMessages.forEach(message => {
      this.hide(message);
    });
  }

  _createMessageElement(message, type) {
    const element = document.createElement('div');
    element.className = `status-message status-${type}`;
    element.textContent = message;

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      float: right;
      background: none;
      border: none;
      font-size: 1.2rem;
      cursor: pointer;
      margin-left: 0.5rem;
      opacity: 0.7;
    `;
    closeBtn.addEventListener('click', () => this.hide(element));

    element.appendChild(closeBtn);

    return element;
  }
}

// Add the slideOut animation to CSS via JavaScript
if (!document.getElementById('status-animations')) {
  const style = document.createElement('style');
  style.id = 'status-animations';
  style.textContent = `
    @keyframes slideOut {
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}
