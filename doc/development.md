# Разработка

Рабочий каталог разработки:

```bash
cd /projects/homepage-studio
```

Staging checkout Homepage для проверки или сборки:

```text
.runtime-build
```

`.runtime-build/` лежит внутри проекта, исключён из git и содержит отдельный checkout upstream [gethomepage/homepage](https://github.com/gethomepage/homepage) с установленным overlay-модом. Это не источник правды; при проблемах каталог можно удалить и создать заново:

```bash
git clone --depth 1 -b dev https://github.com/gethomepage/homepage.git .runtime-build
```

## Правило

Меняем код мода только здесь:

```text
overlay/src/mods/browser-editor/*
overlay/src/pages/api/config/*
```

Core `homepage` не редактируем напрямую, если изменение можно сделать в overlay.

Подробная структура мода описана в [mod-structure.md](mod-structure.md).

## Базовый Component-Цикл

1. Правим `overlay/` и `homepage-component.json`.
2. Проверяем и собираем component artifact:

```bash
npm run check:component
npm run check:tests
npm run release:component
```

3. Устанавливаем локальный trusted checkout через Configurator CLI:

```bash
cd /projects/homepage-configurator
node install.mjs --target /path/to/homepage \
  --component install homepage-studio \
  --component-dir /projects/homepage-studio
```

Для следующей итерации используйте `--component update`, для возврата к Classic — `--component remove`. URL в `--component-dir` не принимаются. Legacy `install.sh --action update-target` относится к сохранённой интегрированной линии, а не к component release.

## Когда Обновлять Patch

`browser-editor.patch` обновляется только если изменились точки встраивания в core:

- `src/pages/index.jsx`
- `src/components/services/*`
- `src/components/bookmarks/*`
- `next.config.js`

Если менялся только код в `overlay/src/mods/browser-editor/*` или `overlay/src/pages/api/config/*`, patch обычно не нужно менять.

## Что Считается Нормальным

В target checkout после установки будут лежать:

- `src/mods/browser-editor/*`
- `src/pages/api/config/background.js`
- `src/pages/api/config/editor.js`

Это runtime-копия компонента внутри target-проекта. Источник правды остаётся в `/projects/homepage-studio/overlay`.

## Component Release

Версия публичного компонента задаётся в `homepage-component.json`, независимо от legacy-версии в `package.json`/`version.json`.

```bash
npm run check:component
npm run check:tests
npm run release:component
```

`release:component` создаёт rootless `dist/homepage-studio-component.tar.gz` и `dist/homepage-component-release.json`. Перед публикацией полный `npm run check` проверяет manifest, release artifact, overlay, upstream patch и smoke install.

## Публикация Component Release

Release tag обязан иметь канонический вид `homepage-studio-v<version>` и точно совпадать с `homepage-component.json`. После `npm run check` и `npm run release:component` создайте non-draft GitHub release и загрузите ровно два public asset:

```bash
gh release create "homepage-studio-v<VERSION>" \
  dist/homepage-studio-component.tar.gz \
  dist/homepage-component-release.json
```

Consumer читает metadata через `/releases/latest/download/homepage-component-release.json`, поэтому release не помечается GitHub prerelease даже при semver suffix `-beta.N`. Название server channel `github-stable` означает закреплённый latest-approved канал, а не обещание stable semver.

Перед публикацией очистите `dist/` от старых артефактов и убедитесь, что metadata содержит только канонический tag, актуальные size и SHA-256.

## Проверка Production

```bash
curl -I -H 'Host: <runtime-host>:3000' http://127.0.0.1:3000/
curl -i -H 'Host: <runtime-host>:3000' http://127.0.0.1:3000/api/config/editor
```
