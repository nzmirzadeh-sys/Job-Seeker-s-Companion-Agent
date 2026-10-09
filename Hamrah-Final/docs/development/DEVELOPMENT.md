# Development Notes

## Local setup

```bash
cd Backend
python -m venv .venv
# activate
pip install -r requirements.txt
python manage.py migrate
python manage.py test -v 2
```

Frontend:

```bash
cd FrontEnd/jobmatch-ui
npm install
npm run dev
```

## Configuration

Copy `Backend/.env.example` to `Backend/.env`.

Never commit:

- `Backend/.env`
- provider API keys
- generated databases
- caches
- `node_modules`
- Python bytecode

## Testing strategy

Stage 3 deterministic matching is kept independent of Django models so its core cases can run as pure Python tests. Django integration tests cover actual user isolation, persistence, and API wiring when a Django runtime is available.

The current package audit attempted Django tests but the provided execution environment lacked Django/DRF and could not install dependencies due disabled network access. Those tests remain in the repository and are not marked as passed.
