// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { IdentityState } from '#lib/domain/types';

declare global {
	namespace App {
		interface Locals {
			identity: IdentityState;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
