const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

let razorpayScriptPromise;

export function loadRazorpayScript() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Razorpay Checkout can only be loaded in a browser.'));
  }
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = RAZORPAY_SCRIPT_URL;
      script.async = true;
      document.body.appendChild(script);
    }

    const handleLoad = () => {
      if (window.Razorpay) resolve();
      else reject(new Error('Razorpay Checkout did not initialize. Reload the page and try again.'));
    };
    const handleError = () => {
      script.remove();
      reject(new Error('Razorpay Checkout could not be loaded. Check your connection and try again.'));
    };

    if (script.dataset.loaded === 'true') {
      handleLoad();
      return;
    }
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      handleLoad();
    }, { once: true });
    script.addEventListener('error', handleError, { once: true });
  }).catch((error) => {
    razorpayScriptPromise = undefined;
    throw error;
  });

  return razorpayScriptPromise;
}
