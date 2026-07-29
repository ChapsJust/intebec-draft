import { beforeEach, describe, expect, it, vi } from 'vitest';

/** `auth.ts` lit sa configuration dans `$env/dynamic/private`, que Vitest ne fournit pas : on le
 * remplace par un objet qu'on pilote depuis les tests. Le mock est déclaré avant l'import du module
 * testé, sans quoi la vraie résolution l'emporterait. */
const env: Record<string, string> = {};
vi.mock('$env/dynamic/private', () => ({ env }));

const { authConfiguree, creerSession, lireSession, ligneCompte, verifierIdentifiants } =
	await import('./auth');

const MOT_DE_PASSE = 'un-mot-de-passe-assez-long';

beforeEach(() => {
	for (const cle of Object.keys(env)) delete env[cle];
	env.AUTH_SECRET = 'secret-de-test';
	env.AUTH_UTILISATEURS = ligneCompte('justin', MOT_DE_PASSE);
});

describe('authConfiguree', () => {
	it('est vraie quand la clé et au moins un compte sont fournis', () => {
		expect(authConfiguree()).toBe(true);
	});

	// Le garde de hooks.server.ts refuse tout quand c'est faux : une variable oubliée doit fermer
	// l'application, pas l'ouvrir.
	it('est fausse sans clé de signature', () => {
		env.AUTH_SECRET = '';
		expect(authConfiguree()).toBe(false);
	});

	it('est fausse sans aucun compte', () => {
		env.AUTH_UTILISATEURS = '';
		expect(authConfiguree()).toBe(false);
	});

	it('est fausse quand la liste de comptes est mal formée', () => {
		env.AUTH_UTILISATEURS = 'justin,sans-sel-ni-empreinte';
		expect(authConfiguree()).toBe(false);
	});
});

describe('verifierIdentifiants', () => {
	it('accepte le bon couple identifiant / mot de passe', () => {
		expect(verifierIdentifiants('justin', MOT_DE_PASSE)).toBe('justin');
	});

	it('ignore la casse et les espaces autour de l’identifiant', () => {
		expect(verifierIdentifiants('  JUSTIN ', MOT_DE_PASSE)).toBe('justin');
	});

	it('refuse un mauvais mot de passe', () => {
		expect(verifierIdentifiants('justin', 'mauvais-mot-de-passe')).toBeNull();
		expect(verifierIdentifiants('justin', '')).toBeNull();
		// Un préfixe correct ne doit pas suffire.
		expect(verifierIdentifiants('justin', MOT_DE_PASSE.slice(0, -1))).toBeNull();
	});

	it('refuse un compte inconnu', () => {
		expect(verifierIdentifiants('pirate', MOT_DE_PASSE)).toBeNull();
	});

	it('refuse une entrée qui n’est pas une chaîne', () => {
		expect(verifierIdentifiants(null, MOT_DE_PASSE)).toBeNull();
		expect(verifierIdentifiants('justin', 42)).toBeNull();
		expect(verifierIdentifiants({}, {})).toBeNull();
	});

	it('donne deux empreintes différentes au même mot de passe pour deux comptes', () => {
		// Le sel est tiré au hasard par compte : deux personnes qui choisissent le même mot de passe
		// ne doivent pas se reconnaître à des empreintes identiques.
		const a = ligneCompte('a', MOT_DE_PASSE).split(':')[2];
		const b = ligneCompte('b', MOT_DE_PASSE).split(':')[2];
		expect(a).not.toBe(b);
	});
});

describe('session', () => {
	it('relit une session qu’elle vient de créer', () => {
		expect(lireSession(creerSession('justin'))).toEqual({ nom: 'justin' });
	});

	it('refuse une signature falsifiée', () => {
		const [nom, expiration] = creerSession('justin').split('.');
		expect(lireSession(`${nom}.${expiration}.signature-inventee`)).toBeNull();
	});

	it('refuse une expiration repoussée à la main', () => {
		// L'échéance est *dans* la charge signée : la modifier invalide la signature.
		const [nom, , signature] = creerSession('justin').split('.');
		expect(lireSession(`${nom}.${Date.now() + 999_999_999}.${signature}`)).toBeNull();
	});

	it('refuse une session expirée', () => {
		vi.useFakeTimers();
		try {
			const session = creerSession('justin');
			vi.setSystemTime(Date.now() + 13 * 60 * 60 * 1000);
			expect(lireSession(session)).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('refuse une session signée avec une autre clé', () => {
		const session = creerSession('justin');
		env.AUTH_SECRET = 'une-autre-cle';
		expect(lireSession(session)).toBeNull();
	});

	it('refuse la session d’un compte retiré de la liste', () => {
		// Retirer quelqu'un de AUTH_UTILISATEURS doit lui couper l'accès tout de suite, sans
		// attendre que sa session expire d'elle-même.
		const session = creerSession('justin');
		env.AUTH_UTILISATEURS = ligneCompte('quelquun-dautre', MOT_DE_PASSE);
		expect(lireSession(session)).toBeNull();
	});

	it('refuse une valeur mal formée', () => {
		for (const valeur of [null, undefined, 42, '', 'justin', 'a.b', 'a.b.c.d']) {
			expect(lireSession(valeur)).toBeNull();
		}
	});
});
