# Aula SMR

Aula SMR is an unofficial study app for **Sistemas Microinformáticos y Redes (SMR)**, a Spanish vocational qualification in computer systems and networking. The interface and example lessons are currently in Spanish.

The app combines short explanations, practice activities, spaced repetition, visual simulations and fictional troubleshooting cases. It is maintained by **kudofanboy**, with AI assistance in development and illustrations.

## Project status

This is the first public demo edition. It contains a small, original example course with six subject areas, fictional contacts and a fictional calendar. It does **not** contain a complete official curriculum, classroom question banks, personal study records or private course documents. The demo is not evidence of broad adoption or measured learning outcomes.

## Run locally

Use Node.js 24 or later and npm.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. The public edition loads its bundled example course and stores progress in the browser. You can export and import your own progress from the profile screen. Do not commit those exports.

```sh
npm test
npm run lint
npm run build
npm run preview
```

`npm run build` creates `dist/`. Build output and installed dependencies are intentionally excluded from Git. This edition has no deployment workflow or hosted access configuration. It does not register a service worker or claim offline installation support.

The optional `servidor/` module is retained for local API development and its regression tests. The default browser demo does not start it or send progress to it.

## Explore the demo

Start with a lesson, read the explanation, and try its check before opening practice or a case. The fictional profile at `?profesor&recorrido=1` unlocks the demo without saving activity. [Demo content and provenance](docs/DEMO-CONTENT.md) describes the included examples.

## Contribute

Report a reproducible problem with the relevant screen, expected behavior and actual behavior. Use fictional data in examples and screenshots. Do not include personal information, classroom material, student records, credentials or local machine paths.

For code changes, run tests, lint and the build. For a new lesson, provide an explanation before asking a question, a reasoned correction, a source, and clear licensing information. Keep contributed course material separate from engine code. Do not add material you are not authorized to share.

Please avoid unrelated redesigns in small fixes. Contributions are welcome under the license of the part being changed; see [licensing](LICENSING.md).

## Privacy

The bundled course, contacts and calendar are fictional. The app does not include analytics or automatically upload browser progress. External links and email actions only run when you choose them. Review exported files and screenshots before sharing them.

## Licenses and attribution

- Original application code: [MIT](LICENSE).
- Original demo course, educational prose and authorized AI-generated artwork: [CC BY 4.0](LICENSE-CONTENT.md), attribution to **kudofanboy**.
- Third-party dependencies, fonts and their authors retain their respective licenses. See [third-party notices](THIRD-PARTY-NOTICES.md).

Suggested attribution: “Aula SMR, by kudofanboy, CC BY 4.0” for the original demo content and artwork. Indicate modifications when sharing adapted content.

Aula SMR is not affiliated with a school or education authority and is not an official teaching or assessment service.
