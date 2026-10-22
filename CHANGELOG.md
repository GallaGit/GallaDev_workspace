# Changelog

## [0.2.0](https://github.com/GallaGit/GallaDev_workspace/compare/v0.1.0...v0.2.0) (2026-10-20)


### Features

* **api:** add ingest limit tests, error boundary, and structured logs ([#54](https://github.com/GallaGit/GallaDev_workspace/issues/54)) ([80e84e0](https://github.com/GallaGit/GallaDev_workspace/commit/80e84e030f63c683e517705afd49f655acf2bf2d))
* **correo:** bandeja tipo Gmail con leído/no leído, archivar y papelera ([#77](https://github.com/GallaGit/GallaDev_workspace/issues/77)) ([cd2a2d1](https://github.com/GallaGit/GallaDev_workspace/commit/cd2a2d1303bfd4d882ef80f74c9f8ea52eb321de))
* **correo:** búsqueda por remitente, asunto y cuerpo con FTS ([#78](https://github.com/GallaGit/GallaDev_workspace/issues/78)) ([7bec2b2](https://github.com/GallaGit/GallaDev_workspace/commit/7bec2b2b0fa0fea11825d14833afdf5ba7a4e5da))
* **correo:** descargar/abrir adjuntos vía URL firmada de Resend ([#76](https://github.com/GallaGit/GallaDev_workspace/issues/76)) ([240c8a5](https://github.com/GallaGit/GallaDev_workspace/commit/240c8a51b6b250a027495a326c8743fbfc122fa7))
* **demo:** passwordless visitor mode with fictional data ([#55](https://github.com/GallaGit/GallaDev_workspace/issues/55)) ([3fcf7e7](https://github.com/GallaGit/GallaDev_workspace/commit/3fcf7e70019fd2f1c2ca93ad2a28d0795532e00d))
* **email:** compose + borradores desde hola@ / ociel@ ([#67](https://github.com/GallaGit/GallaDev_workspace/issues/67)) ([83fa4fc](https://github.com/GallaGit/GallaDev_workspace/commit/83fa4fc303f35576c8695d7e7da78c0c09541149))
* **email:** dual mailbox hola@ + ociel@ (V1) ([#66](https://github.com/GallaGit/GallaDev_workspace/issues/66)) ([8b5ca3e](https://github.com/GallaGit/GallaDev_workspace/commit/8b5ca3e93b0c17e44a4a2f6d6ca241288f3458a6))
* **email:** módulo Correo — buzón de empresa hola@galladev.com ([#65](https://github.com/GallaGit/GallaDev_workspace/issues/65)) ([1389cae](https://github.com/GallaGit/GallaDev_workspace/commit/1389cae598bc6d8c729a20706c0e0d43e1ab9d46))
* **i18n:** English as second language + live demo README ([#74](https://github.com/GallaGit/GallaDev_workspace/issues/74)) ([9d099d9](https://github.com/GallaGit/GallaDev_workspace/commit/9d099d95b6ec12977aed8679dca3de658819f5e3))
* Kanban cleanup, Statistics charts, and release hygiene ([#43](https://github.com/GallaGit/GallaDev_workspace/issues/43)) ([7d53383](https://github.com/GallaGit/GallaDev_workspace/commit/7d53383a88792d2ce63939884f91ab3f8212ef93))
* **leads:** validate PATCH bodies with zod ([#42](https://github.com/GallaGit/GallaDev_workspace/issues/42)) ([7e89e07](https://github.com/GallaGit/GallaDev_workspace/commit/7e89e076670ce4cc8745742d994fee88c17e471f))
* **rate-limit:** cupo persistente con Upstash (@upstash/ratelimit) y fallback en memoria ([#89](https://github.com/GallaGit/GallaDev_workspace/issues/89)) ([657c539](https://github.com/GallaGit/GallaDev_workspace/commit/657c539e0ede4d3131edd2413a364df06a5274d5))
* **retention:** borrado automático de datos personales (12 meses / 6 años) — NO MERGE ([#90](https://github.com/GallaGit/GallaDev_workspace/issues/90)) ([833e856](https://github.com/GallaGit/GallaDev_workspace/commit/833e8562ab31d4c49c0147f77a15f41df14bb5a5))
* **seguridad:** elimina webhooks y automatizaciones salientes de n8n (cierra GDW-SEC-009) ([#85](https://github.com/GallaGit/GallaDev_workspace/issues/85)) ([a46456e](https://github.com/GallaGit/GallaDev_workspace/commit/a46456eee474ba253c278fae806e79e209744b3c))


### Bug Fixes

* **auth:** require roles on settings, lead writes, AI and team ([#44](https://github.com/GallaGit/GallaDev_workspace/issues/44)) ([14ccadd](https://github.com/GallaGit/GallaDev_workspace/commit/14ccadd4fbcabdcb4de53f3304f23ed3d7b1e0ae))
* **correo:** abrir adjuntos vía proxy en una sola pestaña ([#87](https://github.com/GallaGit/GallaDev_workspace/issues/87)) ([7c26a35](https://github.com/GallaGit/GallaDev_workspace/commit/7c26a35a24b6602c255a8573da61dc6c45a4f101))
* **correo:** acepta cdn.resend.app en URLs de descarga de adjuntos ([#86](https://github.com/GallaGit/GallaDev_workspace/issues/86)) ([690b7e8](https://github.com/GallaGit/GallaDev_workspace/commit/690b7e8d44d64f49491f8f85c11c6018386d4d8b))
* **correo:** Fase 0 — cuerpos Receiving, hilos y backfill Admin ([#75](https://github.com/GallaGit/GallaDev_workspace/issues/75)) ([0ece90f](https://github.com/GallaGit/GallaDev_workspace/commit/0ece90f9b4e98215069bec3564d9829771eb92d3))
* **correo:** hilos con Message-ID real de Resend, re-hilado Admin, responder a todos, reenviar y borradores de respuesta ([#79](https://github.com/GallaGit/GallaDev_workspace/issues/79)) ([a427904](https://github.com/GallaGit/GallaDev_workspace/commit/a427904123bf62035600fbd5fd7cf4e95feba3d8))
* **correo:** sanitize-html loadable on Vercel + JSON errors always (empty 500 → "Unexpected end of JSON input") ([#72](https://github.com/GallaGit/GallaDev_workspace/issues/72)) ([4fe0544](https://github.com/GallaGit/GallaDev_workspace/commit/4fe054401667ceee9ab531fdb44524d19c5fe0ad))
* **security:** alta sin rol, alcance de leads y HTML de correo ([#69](https://github.com/GallaGit/GallaDev_workspace/issues/69)) ([4c2f90e](https://github.com/GallaGit/GallaDev_workspace/commit/4c2f90e9a6e2402e2f1b4e7256b14acffb511f09))
* **security:** close low findings SEC-014 through SEC-018 ([#71](https://github.com/GallaGit/GallaDev_workspace/issues/71)) ([08b6a15](https://github.com/GallaGit/GallaDev_workspace/commit/08b6a159f87768ea2902c26dd0e5d5e6ed60f2dd))
* **security:** close medium findings SEC-005 through SEC-013 ([#70](https://github.com/GallaGit/GallaDev_workspace/issues/70)) ([f8a8cc9](https://github.com/GallaGit/GallaDev_workspace/commit/f8a8cc971a6593e4db8374ace6f80a6f7292eb4f))
* **seguridad:** GDW-SEC-022 y GDW-SEC-023 ([#80](https://github.com/GallaGit/GallaDev_workspace/issues/80)) ([3ab5278](https://github.com/GallaGit/GallaDev_workspace/commit/3ab5278724f01c630f81e013835ae28194555c56))
* **seguridad:** SEC-020, SEC-021 y cupo en PATCH /api/team ([#84](https://github.com/GallaGit/GallaDev_workspace/issues/84)) ([d34617a](https://github.com/GallaGit/GallaDev_workspace/commit/d34617aafbcf5ceadbe987c54178e4e858373fc3))


### Security

* stop tracking the Supabase auth file ([#68](https://github.com/GallaGit/GallaDev_workspace/issues/68)) ([e02658c](https://github.com/GallaGit/GallaDev_workspace/commit/e02658c5c3b96331bf6186019774725645170022))


### Documentation

* align documentation with master (Supabase Auth, RBAC, M2, visitor demo) ([#56](https://github.com/GallaGit/GallaDev_workspace/issues/56)) ([e13762c](https://github.com/GallaGit/GallaDev_workspace/commit/e13762c228f53979c63fa2c8c7dad4463ed293c5))
* company email as GDW inbox module (hola@ only, Resend inbound) ([#64](https://github.com/GallaGit/GallaDev_workspace/issues/64)) ([8a86466](https://github.com/GallaGit/GallaDev_workspace/commit/8a86466e49cb29a4e93ae2efa887e64aa6c67714))
* **portal:** especificar el portal de cliente ([#58](https://github.com/GallaGit/GallaDev_workspace/issues/58)) ([be550ca](https://github.com/GallaGit/GallaDev_workspace/commit/be550ca39ae32d380ccebf111bfa42985b874355))
* **roadmap:** record M2 Slice 1 CI gates and prod close ([#53](https://github.com/GallaGit/GallaDev_workspace/issues/53)) ([4962b44](https://github.com/GallaGit/GallaDev_workspace/commit/4962b447fe8f8644c394f160482ddbb48a8aeaac))
* sección ¿Qué es? en login y prioridad urgente email de empresa ([#61](https://github.com/GallaGit/GallaDev_workspace/issues/61)) ([6a4e11f](https://github.com/GallaGit/GallaDev_workspace/commit/6a4e11f54a6b1f807e95274888e6a8a681da22a6))
