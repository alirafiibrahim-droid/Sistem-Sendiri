# SIORG - Sistem Informasi Organisasi

Sistem informasi terintegrasi untuk manajemen organisasi kemahasiswaan. Dibangun dengan Next.js 16, Supabase, dan Tailwind CSS.

## Tech Stack

- **Framework:** Next.js 16 (App Router + Turbopack)
- **Database:** PostgreSQL via Supabase
- **Auth:** Supabase Auth (SSR)
- **UI:** Tailwind CSS v4, custom components
- **Validation:** Zod v4
- **Runtime:** Node.js (proxy convention, bukan middleware)

## Modul

| Modul | Endpoint | Deskripsi |
|---|---|---|
| Auth | `/login` | Login/logout via Supabase Auth |
| Program Kerja | `/programs` | CRUD program kerja, kanban board tugas |
| Keuangan | `/finances` | Pencatatan transaksi (income/expense) |
| Keatletan | `/athletics` | Metrik latihan & penilaian atlet |
| Prestasi | `/achievements` | Pencapaian organisasi/individu |
| Anggota | `/members` | Manajemen profil & keanggotaan |
| Persuratan | `/letters` | Surat masuk & keluar |
| Sertijab | `/handovers` | Serah terima jabatan |
| Proyek Insidental | `/projects` | Proyek di luar program kerja |
| Pengaturan | `/settings` | Konfigurasi sistem |

## Getting Started

### Prerequisites

- Node.js 18+
- Akun Supabase dengan project aktif

### Installation

```bash
npm install
```

### Environment Variables

Buat file `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

### Development

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

### Build & Start

```bash
npm run build
npm run start
```

## Database Schema

Schema lengkap ada di `schema.sql`. Untuk inisialisasi database, jalankan seluruh isi file tersebut di **Supabase SQL Editor**.

### Struktur Tabel Utama

- `profiles` - Profil user (terhubung ke auth.users via trigger)
- `divisions` - Daftar divisi/bidang
- `programs` - Program kerja
- `program_members` - Kepanitiaan program
- `tasks` - Tugas dalam program (Kanban)
- `finances` - Transaksi keuangan
- `dues_templates` & `dues_payments` - Template & pembayaran iuran
- `achievements` - Prestasi
- `athletic_metrics` & `training_sessions` - Data keatletan
- `letters` - Persuratan
- `handovers` - Sertijab
- `incidental_projects` & related - Proyek insidental
- `audit_logs` - Log aktivitas

## API Endpoints

Semua API berada di bawah `/api/` dengan format response standar:

```json
{
  "success": true,
  "data": {},
  "meta": { "total": 0, "page": 1, "limit": 25 }
}
```

### Authentication

Semua endpoint memerlukan header `x-user-id` yang diinject oleh proxy (`src/proxy.ts`). Proxy melakukan session refresh Supabase pada setiap request ke `/api/*`.

## Roles & Permissions

| Role | Keterangan |
|---|---|
| `ADMIN` | Akses penuh, bypass RLS |
| `PENGURUS_INTI` | Ketua, Sekretaris, Bendahara |
| `KABID` | Kepala Bidang/Divisi |
| `ANGGOTA` | Anggota biasa |

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/        # Halaman dashboard (protected)
│   │   ├── programs/       # Program kerja
│   │   ├── finances/       # Keuangan
│   │   ├── athletics/      # Keatletan
│   │   ├── achievements/   # Prestasi
│   │   ├── members/        # Anggota
│   │   ├── letters/        # Persuratan
│   │   ├── handovers/      # Sertijab
│   │   ├── projects/       # Proyek insidental
│   │   └── settings/       # Pengaturan
│   ├── api/                # API routes
│   └── login/              # Halaman login
├── components/
│   ├── layout/             # Sidebar, header
│   └── ui/                 # UI components (button, card, dll)
├── lib/
│   ├── supabase/           # Supabase client & server
│   ├── types/              # TypeScript types
│   └── validations/        # Zod schemas
└── proxy.ts                # Proxy (auth session refresh)
```

## Catatan Penting

- File `middleware.ts` sudah dimigrasi ke `proxy.ts` (Next.js 16 convention)
- `dev.log` di- exclude dari git via `.gitignore`
- File SQL fix RLS: `supabase-fix-rls-programs.sql`
