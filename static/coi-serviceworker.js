/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
let coepCredentialless = false;
if (typeof window === 'undefined') {
	self.addEventListener('install', () => self.skipWaiting());
	self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

	self.addEventListener('message', (event) => {
		if (!event.data) return;
		if (event.data.type === 'deregister') {
			self.registration
				.unregister()
				.then(() => self.clients.matchAll())
				.then((clients) => clients.forEach((client) => client.navigate(client.url)));
		} else if (event.data.type === 'coepCredentialless') {
			coepCredentialless = event.data.value;
		}
	});

	self.addEventListener('fetch', (event) => {
		const request = event.request;
		if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

		const outgoingRequest =
			coepCredentialless && request.mode === 'no-cors'
				? new Request(request, { credentials: 'omit' })
				: request;
		event.respondWith(
			fetch(outgoingRequest)
				.then((response) => {
					if (response.status === 0) return response;

					const headers = new Headers(response.headers);
					headers.set(
						'Cross-Origin-Embedder-Policy',
						coepCredentialless ? 'credentialless' : 'require-corp'
					);
					if (!coepCredentialless) {
						headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
					}
					headers.set('Cross-Origin-Opener-Policy', 'same-origin');

					return new Response(response.body, {
						status: response.status,
						statusText: response.statusText,
						headers
					});
				})
				.catch((error) => console.error(error))
		);
	});
} else {
	(() => {
		const coi = {
			shouldRegister: () => true,
			shouldDeregister: () => false,
			coepCredentialless: () => !(window.chrome || window.netscape),
			doReload: () => window.location.reload(),
			quiet: false,
			...window.coi
		};

		const serviceWorker = navigator.serviceWorker;
		if (serviceWorker?.controller) {
			serviceWorker.controller.postMessage({
				type: 'coepCredentialless',
				value: coi.coepCredentialless()
			});
			if (coi.shouldDeregister()) {
				serviceWorker.controller.postMessage({ type: 'deregister' });
			}
		}

		if (window.crossOriginIsolated !== false || !coi.shouldRegister()) return;
		if (!window.isSecureContext) {
			if (!coi.quiet) {
				console.log('COOP/COEP Service Worker not registered, a secure context is required.');
			}
			return;
		}

		if (serviceWorker) {
			serviceWorker.register(document.currentScript.src).then(
				(registration) => {
					if (!coi.quiet) console.log('COOP/COEP Service Worker registered', registration.scope);
					registration.addEventListener('updatefound', () => {
						if (!coi.quiet) {
							console.log('Reloading page to make use of updated COOP/COEP Service Worker.');
						}
						coi.doReload();
					});
					if (registration.active && !serviceWorker.controller) {
						if (!coi.quiet) {
							console.log('Reloading page to make use of COOP/COEP Service Worker.');
						}
						coi.doReload();
					}
				},
				(error) => {
					if (!coi.quiet) console.error('COOP/COEP Service Worker failed to register:', error);
				}
			);
		}
	})();
}