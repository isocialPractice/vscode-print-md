# vscode-print-md TODO

## Documentation

- [ ] Instructional GIF.
- [X] Polish documentation.
- [x] GitHub action on commit run `test/coding-standards.test.js`.
- [x] Sandbox test.
  - [x] Windows
  - [x] Mac (*good enough*)
  - [x] Unix

## Extension

> [!Caution]
> Setting color mode with `pypdf` changes the printer's settings, and should be avoided.

- [x] Support data files in `src` for html where raw data from `return` is output from template literals.
- [x] Float left embedded print settings.
  - [x] Select printer.
  - [x] ~~Color or B&W~~.
  - [x] Page range.
- [x] Clean temp date in `C:\Users\johnh\AppData\Local\Temp\` after print.

## Test

- [x] Account for `python` syntax of:

```python
variable_name = (pdf_path.find("AppData\\Roaming\\Code\\User\\globalStorage") > -1 or 
                 pdf_path.find("\\Temp\\") > -1 or 
                 pdf_path.find("\\temp\\") > -1)
```

## Publishing

- [ ] Update external source links i.e. `johns-book` for `icon.png` elements.
- [ ] New Organization
  - [ ] Use `nocostdownloads` and `nocostdownload`.
  - [ ] Branding and clear use for oranization.
    - [ ] Branding assets.
    - [ ] GitHub pages for site.
      - [ ] Learn basics.
      - [ ] Make dummy content that is recyclable.
        - [ ] Test on dummy using `nobedee`.
      - [ ] Make content and copy.

## Possible New Features

- [ ] Paper size.