/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Language = 'hu' | 'en';

type TranslationKey = keyof typeof translations.en;

const translations = {
	en: {
		loading: 'Loading...',
		loginRequired: 'Please log in to access this page.',
		checks: 'Checks',
		admin: 'Admin',
		login: 'Login',
		logout: 'Logout',
		language: 'Language',
		hungarian: 'Hungarian',
		english: 'English',
		teacherChecks: 'Teacher checks',
		studentCheckUpload: 'Student check upload',
		uploadCheck: 'Upload a check',
		teacherUploadDescription: 'Upload a ZIP archive with an optional student assignment.',
		studentUploadDescription: 'Upload a ZIP archive for checking. A Neptun code is required.',
		neptunRequired: 'required',
		optional: 'optional',
		zipArchive: 'ZIP archive',
		zipLimit: 'ZIP files up to 1 MiB.',
		uploading: 'Uploading...',
		uploadForChecking: 'Upload for checking',
		myUploadedChecks: 'My uploaded checks',
		openSubmittedChecks: 'Open the checks you have submitted.',
		viewMyChecks: 'View my checks',
		searchByNeptun: 'Search by Neptun code',
		findStudentChecks: 'Find all checks associated with a student.',
		searchChecks: 'Search checks',
		allChecks: 'All checks',
		reviewAllChecks: 'Review and manage every uploaded check.',
		viewAllChecks: 'View all checks',
		newUpload: 'New upload',
		loadingChecks: 'Loading checks...',
		noChecks: 'No checks have been uploaded yet.',
		noMyChecks: 'You have not uploaded any checks yet.',
		noStudentChecks: 'No checks found for this student.',
		runId: 'Run ID',
		uploadedBy: 'Uploaded by',
		student: 'Student',
		uploaded: 'Uploaded',
		checked: 'Checked',
		pending: 'Pending',
		unknown: 'Unknown',
		unassigned: 'Unassigned',
		loginTitle: 'Login',
		username: 'Username',
		password: 'Password',
		signIn: 'Sign In',
		loginFailed: 'Login failed',
		networkError: 'Network error',
		checkDetails: 'Check details',
		backToChecks: 'Back to checks',
		checkInformation: 'Check information',
		processingStatus: 'Processing status',
		done: 'Done',
		recheckingIn: 'Updating in {seconds}s...',
		loadingStatus: 'Loading status...',
		reRunCheck: 'Re-run check',
		deleteCheck: 'Delete check',
		copyStudentLink: 'Copy link for student',
		downloadSource: 'Download source ZIP',
		noResults: 'No check results returned.',
		skippedNotReturned: 'Check was not returned; marked as skipped.',
		downloadAttachment: 'Download attachment',
		adminAccess: 'Administrator access is required.',
		adminPanel: 'Admin panel',
		createUser: 'Create user',
		displayName: 'Display name',
		administrator: 'Administrator',
		users: 'Users',
		action: 'Action',
		newPassword: 'new password',
		students: 'Students',
		importStudents: 'Import students',
		studentSearch: 'Search students',
		initials: 'Initials',
		notes: 'Notes',
		save: 'Save',
		delete: 'Delete',
		previous: 'Previous',
		next: 'Next',
		importCsv: 'Import CSV',
		noStudents: 'No students yet.',
		noStudentMatches: 'No students match the search.',
		pageOf: 'Page {page} of {total}',
		selectZip: 'Select a ZIP file first.',
		zipTooLarge: 'The ZIP file must not exceed 1 MiB.',
		captchaRequired: 'Complete the CAPTCHA before uploading.',
		neptunCode: 'Neptun code',
		neptunRequiredError: 'A six-character Neptun code is required for student uploads.',
		neptunLength: 'The Neptun code must be exactly 6 characters.',
		captchaLoad: 'CAPTCHA could not be loaded.',
		uploadFailed: 'Could not upload the check.',
		uploadNetworkError: 'Network error while uploading the check.',
		couldNotLoadChecks: 'Could not load checks.',
		checkNetworkError: 'Network error while loading checks.',
		invalidCheckId: 'Invalid check ID.',
		checkStatusError: 'Could not load check status.',
		checkResultsError: 'Could not load check results.',
		checkQueued: 'Check queued for re-run.',
		checkReRunError: 'Could not re-run the check.',
		checkDeleted: 'Could not delete the check.',
		confirmReRun: 'Are you sure you want to re-run this check?',
		confirmDeleteCheck: 'Are you sure you want to delete this check?',
		studentLinkCopied: 'Student link copied.',
		copyStudentLinkError: 'Could not copy the student link.',
		notDocumented: 'This check is not documented in the current check list.',
		pass: 'Pass',
		fail: 'Fail',
		skip: 'Skip'
	},
	hu: {
		loading: 'Betöltés...',
		loginRequired: 'A funkció használatához be kell jelentkezni.',
		checks: 'Ellenőrzések',
		admin: 'Admin',
		login: 'Bejelentkezés',
		logout: 'Kijelentkezés',
		language: 'Nyelv',
		hungarian: 'Magyar',
		english: 'Angol',
		teacherChecks: 'Oktatói ellenőrzések',
		studentCheckUpload: 'Hallgatói ellenőrzés feltöltése',
		uploadCheck: 'Ellenőrzés feltöltése',
		teacherUploadDescription: 'Tölts fel egy ZIP-archívumot, opcionális hallgatói hozzárendeléssel.',
		studentUploadDescription: 'Tölts fel egy ellenőrzendő ZIP-archívumot. A Neptun-kód megadása kötelező.',
		neptunRequired: 'kötelező',
		optional: 'opcionális',
		zipArchive: 'ZIP-archívum',
		zipLimit: 'Legfeljebb 1 MiB méretű ZIP-fájlok.',
		uploading: 'Feltöltés...',
		uploadForChecking: 'Feltöltés ellenőrzésre',
		myUploadedChecks: 'Saját feltöltött ellenőrzések',
		openSubmittedChecks: 'A beküldött ellenőrzések megnyitása.',
		viewMyChecks: 'Saját ellenőrzések megtekintése',
		searchByNeptun: 'Keresés Neptun-kód alapján',
		findStudentChecks: 'A hallgatóhoz tartozó összes ellenőrzés keresése.',
		searchChecks: 'Ellenőrzések keresése',
		allChecks: 'Összes ellenőrzés',
		reviewAllChecks: 'Az összes feltöltött ellenőrzés áttekintése és kezelése.',
		viewAllChecks: 'Összes ellenőrzés megtekintése',
		newUpload: 'Új feltöltés',
		loadingChecks: 'Ellenőrzések betöltése...',
		noChecks: 'Még nincs feltöltött ellenőrzés.',
		noMyChecks: 'Még nem töltöttél fel ellenőrzést.',
		noStudentChecks: 'Ehhez a hallgatóhoz nem található ellenőrzés.',
		runId: 'Futtatás azonosítója',
		uploadedBy: 'Feltöltő',
		student: 'Hallgató',
		uploaded: 'Feltöltve',
		checked: 'Ellenőrizve',
		pending: 'Folyamatban',
		unknown: 'Ismeretlen',
		unassigned: 'Nincs hozzárendelve',
		loginTitle: 'Bejelentkezés',
		username: 'Felhasználónév',
		password: 'Jelszó',
		signIn: 'Bejelentkezés',
		loginFailed: 'Sikertelen bejelentkezés',
		networkError: 'Hálózati hiba',
		checkDetails: 'Ellenőrzés részletei',
		backToChecks: 'Vissza az ellenőrzésekhez',
		checkInformation: 'Ellenőrzés adatai',
		processingStatus: 'Feldolgozás állapota',
		done: 'Kész',
		recheckingIn: 'Frissítés {seconds} másodperc múlva...',
		loadingStatus: 'Állapot betöltése...',
		reRunCheck: 'Ellenőrzés újrafuttatása',
		deleteCheck: 'Ellenőrzés törlése',
		copyStudentLink: 'Hallgatói hivatkozás másolása',
		downloadSource: 'Forrás ZIP letöltése',
		noResults: 'Nem érkezett eredmény.',
		skippedNotReturned: 'Az ellenőrzés nem adott eredményt; kihagyottként jelölve.',
		downloadAttachment: 'Csatolmány letöltése',
		adminAccess: 'A funkcióhoz adminisztrátori jogosultság szükséges.',
		adminPanel: 'Adminisztrációs felület',
		createUser: 'Felhasználó létrehozása',
		displayName: 'Megjelenítendő név',
		administrator: 'Adminisztrátor',
		users: 'Felhasználók',
		action: 'Művelet',
		newPassword: 'új jelszó',
		students: 'Hallgató',
		importStudents: 'Hallgatók importálása',
		studentSearch: 'Hallgatók keresése',
		initials: 'Monogram',
		notes: 'Megjegyzések',
		save: 'Mentés',
		delete: 'Törlés',
		previous: 'Előző',
		next: 'Következő',
		importCsv: 'CSV importálása',
		noStudents: 'Még nincs hallgató.',
		noStudentMatches: 'Nincs a keresésnek megfelelő hallgató.',
		pageOf: '{page}. oldal / {total}',
		selectZip: 'Először válassz ki egy ZIP-fájlt.',
		zipTooLarge: 'A ZIP-fájl mérete legfeljebb 1 MiB lehet.',
		captchaRequired: 'Feltöltés előtt töltsd ki a CAPTCHA-t.',
		neptunCode: 'Neptun-kód',
		neptunRequiredError: 'Hallgatói feltöltéshez hat karakteres Neptun-kód szükséges.',
		neptunLength: 'A Neptun-kódnak pontosan 6 karakterből kell állnia.',
		captchaLoad: 'A CAPTCHA nem tölthető be.',
		uploadFailed: 'Az ellenőrzés feltöltése sikertelen.',
		uploadNetworkError: 'Hálózati hiba az ellenőrzés feltöltése közben.',
		couldNotLoadChecks: 'Az ellenőrzések betöltése sikertelen.',
		checkNetworkError: 'Hálózati hiba az ellenőrzések betöltése közben.',
		invalidCheckId: 'Érvénytelen ellenőrzési azonosító.',
		checkStatusError: 'Az ellenőrzés állapota nem tölthető be.',
		checkResultsError: 'Az ellenőrzés eredményei nem tölthetők be.',
		checkQueued: 'Az ellenőrzés újrafuttatása sorba állítva.',
		checkReRunError: 'Az ellenőrzés újrafuttatása sikertelen.',
		checkDeleted: 'Az ellenőrzés törlése sikertelen.',
		confirmReRun: 'Biztosan újra szeretnéd indítani ezt az ellenőrzést?',
		confirmDeleteCheck: 'Biztosan törölni szeretnéd ezt az ellenőrzést?',
		studentLinkCopied: 'A hallgatói hivatkozás másolva.',
		copyStudentLinkError: 'A hallgatói hivatkozás nem másolható.',
		notDocumented: 'Ez az ellenőrzés nem szerepel az aktuális ellenőrzési listában.',
		pass: 'Sikeres',
		fail: 'Sikertelen',
		skip: 'Kihagyva'
	}
} as const;

type LanguageContextValue = {
	language: Language;
	setLanguage: (language: Language) => void;
	t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
	const [language, setLanguageState] = useState<Language>(() => {
		const saved = window.localStorage.getItem('language');
		return saved === 'en' || saved === 'hu' ? saved : 'hu';
	});

	const setLanguage = (nextLanguage: Language) => {
		setLanguageState(nextLanguage);
		window.localStorage.setItem('language', nextLanguage);
		document.documentElement.lang = nextLanguage;
	};

	useEffect(() => {
		document.documentElement.lang = language;
	}, [language]);

	const value = useMemo<LanguageContextValue>(
		() => ({
			language,
			setLanguage,
			t: (key, values) => {
				let text: string = translations[language][key];
				for (const [name, replacement] of Object.entries(values ?? {})) text = text.replace(`{${name}}`, String(replacement));
				return text;
			}
		}),
		[language]
	);

	return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
	const context = useContext(LanguageContext);
	if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
	return context;
}

export function translateCheckHelp(name: string, help: string, language: Language) {
	if (language === 'en') return help;
	const helpTranslations: Record<string, string> = {
		unzip: 'Megnyitja és kibontja a beküldött ZIP-archívumot. Az archívumnak érvényesnek és biztonságosan kibonthatónak kell lennie.',
		sanity: 'Ellenőrzi, hogy az archívum legalább 1 PDF-et, 2 C-forrásfájlt, 2 fejlécfájlt és 1 debugmalloc.h fájlt tartalmaz-e.',
		compile:
			'A programot GCC-vel, a -Wall, -Wextra, -Wpedantic és -Wvla kapcsolókkal fordítja. Az SDL2 vagy SDL3 fejléceinek szerepelniük kell, és a támogatott SDL-könyvtárak csatolva vannak.',
		debugmalloc:
			'Minden beillesztett debugmalloc.h fájlt összehasonlít a megadott InfoC-referenciával. Az eltérést jelzi, és a későbbi ellenőrzésekhez lecserélheti a fájlt.',
		'cg3-complete':
			'A teljes CG3 statikusanalízis-készletet futtatja, beleértve az arityck, bugmalloc, chonktion, fio, fleak, globus, hunction és t ellenőrzéseket.',
		'cg3-arityck': 'Felsorolja a gyanúsan sok paraméterrel rendelkező függvényeket. Jelenleg legalább 5 paraméter esetén jelez.',
		'cg3-bugmalloc':
			'Azokat a memóriafoglalási hívásokat keresi, amelyek nem a debugmalloc.h-n keresztül történnek, például malloc, calloc, realloc, free és strdup.',
		'cg3-chonktion': 'A valószínűleg szükségtelenül nagy függvényeket keresi. A legalább 64, 128 vagy 256 utasítást tartalmazó függvényeket jelzi.',
		'cg3-fio': 'Felsorolja a forráskódban talált fájlműveleteket. Ez az ellenőrzés a műveleteket jelzi, nem minősíti őket hibásnak.',
		'cg3-fleak': 'Valószínűsíthető fájlkezelő-szivárgásokat keres, például amikor egy függvény FILE-pointert vesz át, de nem zárja be és nem adja vissza.',
		'cg3-globus': 'Ellenőrzi, hogy a program tartalmaz-e globális változókat.',
		'cg3-hunction': 'Összegyűjti a fejlécfájlokban definiált függvényeket.',
		'cg3-t': 'Biztos nagyon hasznos.',
		cg: 'Hívási gráfot készít a program függvényeiből.'
	};
	return helpTranslations[name] ?? help;
}
