---
name: Expense Summary App Plan
overview: Plan i dokumentacja wymagań dla aplikacji Full-stack (React + NestJS) do personalizowanych, automatycznych podsumowań wydatków na podstawie plików z Nextcloud.
todos:
  - id: setup_repos
    content: Inicjalizacja środowiska monorepo lub dwóch osobnych repozytoriów (React i NestJS)
    status: pending
  - id: setup_db
    content: Konfiguracja bazy danych (Supabase) i schematu Prisma ORM dla tabel User i Template
    status: pending
  - id: implement_auth
    content: Implementacja autentykacji i logowania użytkownika za pomocą Supabase Auth w NestJS i React
    status: pending
  - id: build_onboarding_ui
    content: Zbudowanie procesu onboardingu na Frontendzie (formularz preferencji)
    status: pending
  - id: implement_ai_template_gen
    content: Implementacja integracji z API modelu DeepSeek w celu generowania szablonów na podstawie ankiety
    status: pending
  - id: build_template_dashboard
    content: Zbudowanie panelu zarządzania szablonami (CRUD szablonów) oraz wyboru aktywnego szablonu i konfiguracji ścieżki pliku Nextcloud
    status: pending
  - id: implement_test_email
    content: Implementacja mechanizmu renderowania e-maili i wysyłki testowej na wybrany adres e-mail (integracja Brevo SMTP)
    status: pending
  - id: implement_nextcloud_webdav
    content: Opracowanie serwisu WebDAV w NestJS do pobierania plików wydatków ze współdzielonego Nextcloud
    status: pending
  - id: implement_cron_webhook
    content: Stworzenie endpointu Webhook dla zewnętrznego crona oraz integracja całościowego procesu kategoryzacji przez AI i rozsyłki emaili
    status: pending
isProject: false
---

# Aplikacja do Automatyzacji Podsumowań Wydatków

## Lista Zadań (To-Dos)
- [x] **setup_repos**: Inicjalizacja środowiska monorepo lub dwóch osobnych repozytoriów (React i NestJS)
- [x] **setup_db**: Konfiguracja bazy danych (Supabase) i schematu Prisma ORM dla tabel User i Template
- [x] **implement_auth**: Implementacja autentykacji i logowania użytkownika za pomocą Supabase Auth w NestJS i React
- [ ] **build_onboarding_ui**: Zbudowanie procesu onboardingu na Frontendzie (formularz preferencji)
- [ ] **implement_ai_template_gen**: Implementacja integracji z API modelu DeepSeek w celu generowania szablonów na podstawie ankiety
- [ ] **build_template_dashboard**: Zbudowanie panelu zarządzania szablonami (CRUD szablonów) oraz wyboru aktywnego szablonu i konfiguracji ścieżki pliku Nextcloud
- [ ] **implement_test_email**: Implementacja mechanizmu renderowania e-maili i wysyłki testowej na wybrany adres e-mail (integracja Brevo SMTP)
- [ ] **implement_nextcloud_webdav**: Opracowanie serwisu WebDAV w NestJS do pobierania plików wydatków ze współdzielonego Nextcloud
- [ ] **implement_cron_webhook**: Stworzenie endpointu Webhook dla zewnętrznego crona oraz integracja całościowego procesu kategoryzacji przez AI i rozsyłki emaili

## 1. Cel projektu
Aplikacja ma na celu automatyzację i personalizację procesu kategoryzacji wydatków i wysyłania comiesięcznych podsumowań e-mail. Rozwiązanie przeniesie obecny proces skryptowy do intuicyjnej aplikacji webowej, z zachowaniem dotychczasowego mechanizmu integracji z Nextcloud.

## 2. Architektura Systemu i Technologie
- **Repozytoria**: Dwa oddzielne repozytoria dla aplikacji Frontendowej i Backendowej.
- **Frontend**: React (Vite + React) + Tailwind CSS do stylowania. Stan aplikacji zarządzany przez **Zustand**.
- **Backend**: NestJS wystawiający API w technologii **GraphQL** (podejście Code First).
- **Baza Danych**: PostgreSQL w ekosystemie **Supabase**. Rekomendowany ORM: Prisma.
- **Model AI**: **DeepSeek** (aplikacja używa globalnego klucza API po stronie serwera).
- **E-mail**: Zintegrowane konto SMTP od **Brevo** skonfigurowane w NestJS.

## 3. Wymagania Funkcjonalne

### 3.1. Autentykacja
- Jedna rola w systemie: **Użytkownik**.
- Logowanie i zarządzanie sesją delegowane do **Supabase Auth** (klient w React + weryfikacja JWT w NestJS).

### 3.2. Onboarding (Generowanie szablonu)
- Po pierwszym zalogowaniu użytkownik przechodzi przez interaktywny formularz/ankietę dotyczącą preferencji komunikacyjnych. Ankieta będzie pytała o:
  - **Ton wiadomości** (np. formalny, humorystyczny, motywacyjny).
  - **Poziom szczegółowości** (np. tylko podsumowanie vs wyliczenie każdej pozycji).
  - **Główny nacisk** (np. ile udało się zaoszczędzić vs gdzie wydano za dużo).
  - **Styl wizualny HTML** (np. minimalistyczny, kolorowy, korporacyjny).
- Na podstawie odpowiedzi, backend łączy się z modelem AI (DeepSeek), który przygotowuje dopasowany, spersonalizowany szablon e-mail jako **czysty kod HTML**.
- Szablon ten zapisywany jest w bazie danych jako szablon użytkownika.

### 3.3. Zarządzanie Profilem i Szablonami
- Użytkownik ma dostęp do bazy swoich wcześniej wygenerowanych lub zapisanych szablonów (może między nimi przełączać).
- Użytkownik określa i zapisuje ścieżkę do swojego pliku tekstowego z wydatkami, który znajduje się we współdzielonej instancji Nextcloud.
- Możliwość wysłania **testowej wiadomości e-mail** – system uzupełnia wybrany szablon fikcyjnymi (przykładowymi) danymi i wysyła na adres e-mail użytkownika.

### 3.4. Proces Comiesięczny (Triggerowany Cronem)
- Aplikacja NestJS wystawia zabezpieczony endpoint (np. `/api/cron/process-summaries` z weryfikacją nagłówka `Authorization: Bearer <CRON_SECRET>`).
- Zewnętrzny mechanizm crona (np. systemowy) uderza w ten endpoint na koniec miesiąca.
- Akcja wywołana przez crona:
  1. Pobranie listy aktywnych użytkowników, którzy skonfigurowali ścieżkę do pliku.
  2. Połączenie przez WebDAV z instancją Nextcloud (autoryzacja przy użyciu globalnych danych serwera) i pobranie zawartości pliku każdego z użytkowników.
  3. Przekazanie zawartości pliku do modelu AI z odpowiednim promptem systemowym w celu kategoryzacji, zsumowania i obliczenia różnicy z wypłatą.
  4. Wstrzyknięcie zwróconych przez AI danych do wybranego, spersonalizowanego szablonu.
  5. Wysyłka e-maila za pomocą globalnego klienta SMTP.

## 4. Wymagania Niefunkcjonalne
- **Bezpieczeństwo**: 
  - Ochrona endpointu crona przed wywołaniami przez osoby trzecie.
  - Autoryzacja i bezpieczeństwo sesji oparte na Supabase Auth.
- **Odporność na błędy (Fault tolerance)**: 
  - Aplikacja powinna kontynuować proces dla innych użytkowników, jeżeli u jednego z nich brakuje pliku na Nextcloud, lub plik jest niepoprawny.
  - Rejestrowanie logów z informacją, dla kogo proces zakończył się sukcesem, a dla kogo porażką.

## 5. Proponowany Schemat Bazy Danych
Główne encje (tworzone w publicznym schemacie bazy Supabase, mapowane przez Prisma):
- **User (Profile)**: `id` (zgodne z ID z Supabase Auth), `email`, `nextcloud_file_path`, `active_template_id`, `created_at`
- **Template**: `id`, `user_id`, `name`, `content` (treść w czystym HTML), `created_at`
- **SummaryLog**: (opcjonalnie) do zbierania historii przetworzonych podsumowań.