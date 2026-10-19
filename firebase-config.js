        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
        import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
        import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

        // Dane projektu Firebase są w app-config.js (poza repozytorium, szablon: app-config.example.js).
        const firebaseConfig = window.APP_CONFIG && window.APP_CONFIG.firebase;
        if (!firebaseConfig || !firebaseConfig.apiKey) {
            throw new Error('Brak konfiguracji Firebase — skopiuj app-config.example.js jako app-config.js i uzupełnij dane.');
        }

        const app = initializeApp(firebaseConfig);
        // Kopia danych w telefonie/przeglądarce: aplikacja działa bez internetu,
        // a zmiany zrobione offline wysyłają się same po powrocie sieci.
        const db = initializeFirestore(app, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        });
        const auth = getAuth(app);

        const storage = getStorage(app);
        window.firebaseStorage = storage;
        window.storageRef = ref;
        window.storageUploadBytes = uploadBytes;
        window.storageGetDownloadURL = getDownloadURL;

        // Pliki użytkownika (np. bilety) — trzymane w Storage pod users/{uid}/…, w Firestore zostaje tylko ścieżka i URL.
        window.uploadUserFile = async (file, folder) => {
            if (!currentUserId) throw new Error('Musisz być zalogowany.');
            const safeName = String(file.name || 'plik').replace(/[^\w.\-]+/g, '_');
            const path = `users/${currentUserId}/${folder}/${Date.now().toString(36)}_${safeName}`;
            const fileRef = ref(storage, path);
            await uploadBytes(fileRef, file, { contentType: file.type || undefined });
            return { path, url: await getDownloadURL(fileRef) };
        };
        window.deleteUserFile = async (path) => {
            if (!path) return;
            try { await deleteObject(ref(storage, path)); } catch (e) { console.warn('Usuwanie pliku:', e); }
        };

        window.authMode = 'login';
        let currentUserId = null;
        let unsubscribe = null;
        let viewRestoredForThisLogin = false;

        window.toggleAuthMode = () => {
            window.authMode = (window.authMode === 'login') ? 'register' : 'login';
            document.getElementById('auth-title').innerText = (window.authMode === 'login') ? 'Zaloguj się' : 'Zarejestruj się';
            document.getElementById('auth-primary-btn').innerText = (window.authMode === 'login') ? 'Zaloguj' : 'Stwórz konto';
            document.getElementById('auth-switch-text').innerHTML = (window.authMode === 'login') 
                ? 'Nie masz konta? <span class="auth-toggle" onclick="toggleAuthMode()">Zarejestruj się</span>'
                : 'Masz już konto? <span class="auth-toggle" onclick="toggleAuthMode()">Zaloguj się</span>';
            document.getElementById('auth-error').style.display = 'none';
        };

        window.handleAuth = async () => {
            const email = document.getElementById('auth-email').value;
            const pass = document.getElementById('auth-password').value;
            const errorEl = document.getElementById('auth-error');
            errorEl.style.display = 'none';

            if(!email || !pass) {
                errorEl.innerText = "Wpisz e-mail i hasło.";
                errorEl.style.display = 'block';
                return;
            }

            try {
                document.getElementById('loading-overlay').style.display = 'flex';
                if (window.authMode === 'login') {
                    await signInWithEmailAndPassword(auth, email, pass);
                } else {
                    await createUserWithEmailAndPassword(auth, email, pass);
                }
            } catch (e) {
                document.getElementById('loading-overlay').style.display = 'none';
                let msg = e.message;
                if(e.code === 'auth/invalid-email') msg = "Nieprawidłowy adres e-mail.";
                if(e.code === 'auth/invalid-credential') msg = "Zły e-mail lub hasło.";
                if(e.code === 'auth/email-already-in-use') msg = "Konto z tym e-mailem już istnieje.";
                if(e.code === 'auth/weak-password') msg = "Hasło musi mieć min. 6 znaków.";
                errorEl.innerText = "Błąd: " + msg;
                errorEl.style.display = 'block';
            }
        };

        window.logoutUser = async () => {
            if(confirm("Czy na pewno chcesz się wylogować?")) {
                await signOut(auth);
            }
        };

        onAuthStateChanged(auth, (user) => {
            if (user) {
                // Zalogowano
                currentUserId = user.uid;
                document.getElementById('auth-overlay').style.display = 'none';
                document.getElementById('user-welcome').innerText = `Zalogowany jako: ${user.email}`;
                document.getElementById('loading-overlay').style.display = 'flex';

                viewRestoredForThisLogin = false;
                window._cloudReady = false;
                if(unsubscribe) unsubscribe();
                unsubscribe = onSnapshot(doc(db, "users", currentUserId), (docSnap) => {
                    document.getElementById('loading-overlay').style.display = 'none';

                    // Brak dokumentu w lokalnej kopii (np. pierwsze uruchomienie bez internetu) to nie
                    // to samo co „pusty profil" — czekamy na serwer i do tego czasu blokujemy zapis,
                    // żeby nie nadpisać danych w chmurze pustymi listami.
                    if (!docSnap.exists() && docSnap.metadata.fromCache) return;
                    window._cloudReady = true;

                    // Echo własnego zapisu: nasz lokalny stan jest co najmniej tak świeży jak to, co
                    // właśnie wysłaliśmy (mogliśmy zdążyć zmienić coś jeszcze, zanim echo wróciło z
                    // serwera) — pomiń całe echo, ŁĄCZNIE z przypisaniem window.trips/globalBaseData,
                    // nie tylko re-render. Bez tego długie operacje wsadowe robiące wiele zapisów pod
                    // rząd (np. odtwarzanie Bazy z setek punktów) gubiły większość efektu: każde echo
                    // nadpisywało window.trips/globalBaseData starszą, częściową kopią z serwera.
                    if (window._localWriteInFlight > 0) {
                        window._localWriteInFlight--;
                        return;
                    }

                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        window.trips = data.trips || [];
                        window.globalBaseData = data.globalBase || { folders: [], cardsList: [] };
                        window.research = data.research || [];
                    } else {
                        window.trips = [];
                        window.globalBaseData = { folders: [], cardsList: [] };
                        window.research = [];
                    }

                    // Po pierwszym załadowaniu danych po (re)zalogowaniu wróć do ostatnio otwartej
                    // zakładki zamiast na ekran główny — patrz app-core.js#showMainTab (zapis do
                    // sessionStorage) / restoreLastView (odczyt). Kolejne echa z Firestore w tej
                    // samej sesji już nie przełączają widoku, żeby nie zrywać bieżącej pracy.
                    if (!viewRestoredForThisLogin) {
                        viewRestoredForThisLogin = true;
                        if (window.restoreLastView && window.restoreLastView()) return;
                    }

                    if(window.refreshCurrentView) window.refreshCurrentView();
                }, (error) => {
                    console.error("Błąd pobierania z bazy:", error);
                    document.getElementById('loading-overlay').style.display = 'none';
                });

            } else {
                currentUserId = null;
                document.getElementById('auth-overlay').style.display = 'flex';
                document.getElementById('loading-overlay').style.display = 'none';
                window.trips = [];
                window.globalBaseData = { folders: [], cardsList: [] };
                window.research = [];
                document.getElementById('auth-email').value = '';
                document.getElementById('auth-password').value = '';
                if(unsubscribe) unsubscribe();
                window.showMainTab('home');
            }
        });

        window._localWriteInFlight = 0;

        // === ZAPIS DO CHMURY: natychmiastowy ===
        window.saveDataToCloudNow = async () => {
            if (!currentUserId || !window._cloudReady) return;
            try {

                const cleanTrips = JSON.parse(JSON.stringify(window.trips || []));
                const cleanBase = JSON.parse(JSON.stringify(window.globalBaseData || { folders: [], cardsList: [] }));
                const cleanResearch = JSON.parse(JSON.stringify(window.research || []));

                window._localWriteInFlight++;            // oznacz własny zapis
                await setDoc(doc(db, "users", currentUserId), {
                    trips: cleanTrips,
                    globalBase: cleanBase,
                    research: cleanResearch
                });
            } catch (e) {
                console.error("Błąd zapisu w Firebase:", e);
                alert("Wystąpił problem z zapisem do chmury: " + e.message);
            }
        };

        // === ZAPIS DO CHMURY: debounced (800 ms od ostatniej zmiany) ===
        let _saveTimer = null;
        let _saveDirty = false;
        const SAVE_DEBOUNCE_MS = 800;

        window.scheduleSave = () => {
            _saveDirty = true;
            if (_saveTimer) clearTimeout(_saveTimer);
            _saveTimer = setTimeout(() => {
                _saveTimer = null;
                if (_saveDirty) {
                    _saveDirty = false;
                    window.saveDataToCloudNow();
                }
            }, SAVE_DEBOUNCE_MS);
        };

        // Natychmiastowy flush — wywoływany przy zamykaniu/ukrywaniu karty.
        window.flushSave = () => {
            if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
            if (_saveDirty) {
                _saveDirty = false;
                return window.saveDataToCloudNow();
            }
        };

        // Stare aliasy — teraz przechodzą przez debouncer.
        window.saveDataToCloud = () => window.scheduleSave();
        window.saveTrips      = () => window.scheduleSave();
        window.saveGlobalBase = () => window.scheduleSave();
        window.saveResearch   = () => window.scheduleSave();

        // === SAFETY NET: zamknięcie karty / przejście w tło ===
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') window.flushSave();
        });
        window.addEventListener('beforeunload', () => {
            // beforeunload nie czeka na await — wystarczy że odpalimy zapis.
            window.flushSave();
        });
