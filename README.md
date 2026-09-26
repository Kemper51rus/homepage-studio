<h1>
  <img src="logo-conf.png" alt="Homepage configurator logo" width="36" height="36" align="absmiddle" style="vertical-align: -6px;">
  Homepage Studio
</h1>

> Homepage Studio — compile-time компонент для [Homepage Configurator](https://github.com/Kemper51rus/homepage-configurator). Интегрированная линия до разделения сохранена по тегу `studio-integrated-v0.6.82`; её standalone installer остаётся в репозитории только для совместимости и не является рекомендуемым способом новой установки.

Компонент для [gethomepage/homepage](https://github.com/gethomepage/homepage), который расширяет Classic Configurator и добавляет редактирование dashboard прямо из браузера:

- настройка, добавление и удаление сервисов;
- настройка, добавление и удаление закладок;
- перетаскивание карточек сервисов и закладок мышкой в режиме редактирования;
- перетаскивание страниц-вкладок мышкой в режиме редактирования;
- визуальное редактирование групп и layout-параметров;
- загрузка фонового изображения;
- загрузка внешних URL-иконок в локальный каталог иконок;
- проверка и запуск обновления мода из браузера;
- режим редактирования поверх текущего интерфейса, без отдельной длинной страницы настроек.

<img src="preview.png" width="100%">

## Quick install

1. Установите Homepage и актуальный [Homepage Configurator](https://github.com/Kemper51rus/homepage-configurator).
2. Откройте режим редактирования Configurator.
3. В окне `Обновления` найдите карточку **Homepage Studio** и нажмите `Install`.

Configurator получает последний `homepage-studio-component.tar.gz` из GitHub Releases, проверяет release metadata, версию, размер и SHA-256, безопасно распаковывает архив, выполняет production build и планирует автоматический перезапуск Homepage. Локальные `HOMEPAGE_STUDIO_COMPONENT_DIR` и `HOMEPAGE_CONFIGURATOR_SOURCE_DIR` для штатной установки не нужны.

## Обновление И Удаление

Карточка Homepage Studio в окне `Обновления` поддерживает:

- `Install` — переход Classic → Studio;
- `Update` — проверенная переустановка актуального Studio release;
- `Remove` — возврат Studio → Classic с восстановлением заменённых core-файлов.

Браузер передаёт только фиксированные `componentId=homepage-studio`, `sourceId=github-stable` и операцию. Репозиторий, release URLs и имя артефакта задаются серверным allowlist и не принимаются от клиента. Component host использует maintenance lock, сохраняет manifest/source/build snapshot и выполняет rollback при ошибке сборки или pre-restart endpoint check. `Update` и `Remove` сохраняют persistent-конфиги `service-updates.yaml`, `service-update-sources.yaml`, `three-x-ui.yaml` и runtime data directories; `Remove` восстанавливает заменённые core-файлы и удаляет owned overlay/CSS/scripts.

> Editor API и component mutation API не имеют собственного token-gate. Публикуйте Homepage только за Authentik или другим внешним authentication proxy.

При обновлении самого Homepage Configurator сначала удалите Studio, обновите Classic core и затем снова установите Studio. Подробности и CLI для разработки описаны в [`doc/install.md`](doc/install.md).

## Версии И Релизы

Версия компонента хранится в [`homepage-component.json`](homepage-component.json). Актуальный опубликованный component release доступен по адресу [GitHub Releases / latest](https://github.com/Kemper51rus/homepage-studio/releases/latest). Release состоит из:

- `homepage-studio-component.tar.gz`;
- `homepage-component-release.json` с `schema`, `id`, `version`, `tag`, `artifactName`, `sha256` и `size`.

`package.json` и `version.json` относятся к сохранённой интегрированной/standalone линии и не определяют версию component release.

## Использование

После включения мода кнопка `Edit` появляется только при наведении курсора на левый нижний угол страницы.

В режиме редактирования:

- существующие карточки сервисов и закладок можно открыть кликом и изменить;
- карточки можно перетаскивать мышкой внутри своей группы;
- в конце каждой группы появляется карточка добавления;
- над каждой группой появляется кнопка редактирования группы для названия и разметки;
- панель группы можно перетаскивать на панель другой группы, чтобы поменять порядок;
- верхние страницы-вкладки можно перетаскивать мышкой, чтобы поменять их порядок;
- service-группу можно перетащить на `Drop inside` другой service-группы, чтобы сделать вложенную структуру как `250/300`;
- в нижней панели есть кнопка `Новая группа`, а тип новой группы выбирается уже в окне редактора;
- кнопка `Фон` открывает загрузку фонового изображения;
- кнопка `Иконки` скачивает URL-иконки из `services.yaml` и `bookmarks.yaml` в каталог `icons` внешней папки изображений и заменяет ссылки в YAML на API-пути `/api/config/icon/...`;
- кнопка `Конфигуратор` открывает прямое редактирование `settings.yaml`, `widgets.yaml`, `services.yaml`, `bookmarks.yaml`, `custom.css` и `custom.js`;
- кнопка `Обновления` открывает проверку версии и обновление Homepage Configurator с GitHub;
- кнопка `Done` выключает режим редактирования.
- клавиша `Esc` закрывает открытые окна настроек и выходит из режима редактирования.

Изменения сохраняются в YAML-файлы целевого homepage:

- `config/services.yaml`
- `config/bookmarks.yaml`
- `config/settings.yaml`

Загруженный фон сохраняется в директорию `config` целевого проекта.
Загруженные иконки сохраняются в `${IMAGES_REAL_DIR}/icons`; при установке нашим target-скриптом это `/srv/homepage-images/icons`, а в LXC от Proxmox VE Community Scripts без `IMAGES_REAL_DIR` - `/opt/homepage/public/images/icons`. Редактор прописывает их через `/api/config/icon/...`, поэтому новые файлы начинают отдаваться сразу и не требуют перезапуска `homepage.service`.

Для сервисов при перетаскивании мод автоматически обновляет `weight`, потому что homepage сортирует сервисы внутри группы по этому полю.

Для групп можно редактировать основные параметры из `settings.yaml`:

- `style`
- `columns`
- `header`
- `tab`
- `icon`
- `initiallyCollapsed`

Поле `Страница` в редакторе группы показывает существующие вкладки и при этом позволяет ввести новую вручную.

В окне группы есть быстрые кнопки:

- `Vertical` - обычная вертикальная группа;
- `Horizontal` - группа на всю строку;
- `2/3/4/5 columns` - горизонтальная группа с выбранным числом колонок;
- `Toggle header` - показать или скрыть заголовок группы.

## Документация

- [Установка и удаление](doc/install.md)
- [Структура мода](doc/mod-structure.md)
- [Разработка](doc/development.md)

## Component release

Manifest компонента проверяется и собирается в детерминированный `tar.gz` командой:

```bash
npm run release:component
```

По умолчанию архив и JSON-метаданные создаются в `dist/`. Другой каталог можно задать через `COMPONENT_RELEASE_DIR` (относительный путь считается от корня репозитория). Release tag всегда канонический: `homepage-studio-v<version>` из `homepage-component.json`. Если задан `COMPONENT_RELEASE_TAG`, он обязан точно совпадать с этим значением, иначе сборка останавливается.

В архив входят только `homepage-component.json`, объявленные `overlay.files`, исходники `managedCss` и `runtimeScripts`. Сборка сначала валидирует manifest и отклоняет пути, которые через symlink выходят за корень компонента. JSON-метаданные содержат schema, id/version/tag, имя архива, SHA-256, размер и время создания.

## Проверки

Зависимости для полного набора проверок: `shellcheck` и Chromium для Playwright (`npx playwright install --with-deps chromium`).

```bash
npm run check
npm run check:patch
npm run check:browser
```

Для проверки установки на временный checkout upstream:

```bash
npm run smoke:install
```

## Сборка Standalone

Staging checkout для проверки production-сборки можно держать внутри проекта в `.runtime-build/`. Это служебная копия upstream [gethomepage/homepage](https://github.com/gethomepage/homepage), она исключена из git и может быть удалена/пересоздана.

Если `.runtime-build/` ещё нет:

```bash
git clone --depth 1 -b dev https://github.com/gethomepage/homepage.git .runtime-build
```

Для локальной проверки можно использовать scratch config внутри `.runtime-build`; это не шаблон пользовательских конфигов и не предназначено для публикации:

```bash
mkdir -p .runtime-build/config
./install.sh \
  --action update-target \
  --target .runtime-build \
  --config-dir .runtime-build/config \
  --custom all \
  --no-restart
```
