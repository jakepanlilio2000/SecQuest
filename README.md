# <img src="public/favicon.svg" width="36" height="36" alt=""> SecQuest

**Build your security instinct, one concept at a time.**

An independent Security+ study workspace with original practice questions, spaced review, timed mocks and personal study notes.

[![Project guide](https://img.shields.io/badge/Project_guide-GitHub_Pages-5895ff?logo=github&logoColor=white)](https://jakepanlilio2000.github.io/SecQuest/)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-43853d?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/Built_with-React-149eca?logo=react&logoColor=white)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-5895ff)](LICENSE)

[Get started](#get-started) · [Explore the project](https://jakepanlilio2000.github.io/SecQuest/) · [Report a problem](https://github.com/jakepanlilio2000/SecQuest/issues)

## Your study workspace

| Study your way | What you can do |
| --- | --- |
| Practice with explanations | Answer questions and learn why each option fits—or doesn't. Filter practice by topic and difficulty. |
| Revisit weak areas | Return to missed concepts through spaced reviews and weakness recovery. |
| Prepare at your own pace | Choose a short challenge or a timed mock, then review your answers afterward. |
| Make it memorable | Create flashcards and keep Markdown notes with folders, tags and revision history. |
| Connect the concepts | Browse the knowledge library, explore the concept map and work through fictional defensive labs. |
| Follow your progress | See your study history, review schedule, milestones and achievements. |

## Get started

The [project website](https://jakepanlilio2000.github.io/SecQuest/) contains an introduction and setup guide. To use the learning workspace, run SecQuest on your computer:

1. Install [Node.js 24](https://nodejs.org/), which includes npm, and [Git](https://git-scm.com/).
2. Open a terminal and run:

   ```powershell
   git clone --branch master https://github.com/jakepanlilio2000/SecQuest.git
   cd SecQuest
   npm ci
   npm run dev
   ```

3. Open **http://127.0.0.1:3000**, create an account, and choose your study goal.

No separate database service or Docker installation is needed for local use. Keep `DATABASE_URL` unset for the default local setup. After stopping the app, run `npm run dev` from the same folder to return to your workspace.

The project website does not provide sign-in or save learning progress. Accounts and study records belong to the running SecQuest application.

## Keep your progress safe

Local accounts, answers, review schedules and notes are saved in **`data/secquest.sqlite`**. Keep the `data` folder when updating or moving your installation. Progress does not automatically follow you to another device.

Before installing an update, create a backup using a new filename:

```powershell
npm run db:backup -- data/backups/before-update.sqlite
```

Do not delete the database or copy its files while the app is actively writing to them. Read the [backup and recovery guide](docs/DEPLOYMENT.md#backups) before moving or restoring your workspace. An account export is useful for reading your records, but it does not replace a full database backup or provide an automatic restore.

Notes are private to your account within the app. Protect access to your computer and backups, especially on a shared device. Password-recovery email is available only when the operator has configured email delivery. See [security and privacy](docs/SECURITY.md).

## About the learning material

SecQuest currently includes **44 original starter questions**, mappings to **27 bundled objectives**, and **five fictional defensive simulations**. The bundled alignment is SY0-801 V8 objectives document v2.0, checked October 27, 2026.

The starter material is incomplete and has not received independent subject-matter approval. Use it alongside current official objectives and other trusted study resources. The available bank cannot provide a 90-question mock with distinct questions. Progress estimates are study aids, not predictions of an official exam result.

See [content sources and review](docs/CONTENT.md) for the scope of the material and its references.

## Hosting your own workspace

For an installation available beyond your computer, SecQuest needs a Node server, durable database storage and HTTPS. Follow the [deployment guide](docs/DEPLOYMENT.md) for setup, email delivery and backups.

## License

Original project code and original project documentation are available under the [MIT License](LICENSE). Third-party dependencies, source material and CompTIA's objective taxonomy retain their respective licenses and rights; see [content provenance](docs/CONTENT.md) and the [source register](content/sources.ts).

CompTIA and Security+ are their respective owners' marks. SecQuest is unofficial and is not affiliated with or endorsed by CompTIA. It does not provide actual exam questions or guarantee a passing score.
