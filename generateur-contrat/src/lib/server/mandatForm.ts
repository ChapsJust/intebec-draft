import type { MandatDraft } from '$lib/types';

export interface ParsedMandatSubmission {
	draft: MandatDraft;
	clientId: string | null;
	saveAsNewClient: boolean;
}

export async function parseMandatSubmission(request: Request): Promise<ParsedMandatSubmission> {
	const data = await request.formData();
	const payload = data.get('payload');
	if (typeof payload !== 'string') {
		throw new Error('payload manquant dans la soumission du formulaire');
	}
	return {
		draft: JSON.parse(payload) as MandatDraft,
		clientId: (data.get('clientId') as string) || null,
		saveAsNewClient: data.get('saveAsNewClient') === '1'
	};
}
