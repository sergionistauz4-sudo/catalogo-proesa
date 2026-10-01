# Catálogo de Productos — PROESA

Catálogo web con dos roles:

| Rol | Quién | Qué puede hacer |
|---|---|---|
| **cliente** | Farmacéutico | Ver el catálogo: imagen, nombre, precio y descripción. Nada más. |
| **admin** | Asesor de ventas | CRUD de productos y de clientes + "Vista cliente" para ver lo mismo que ellos. |

**Login**
- Cliente → **nombre** registrado + **NIT** como contraseña. No importan mayúsculas, tildes, puntos ni guiones (`farmacia san jose` + `1023456-019` entra como "Farmacia San José" / `1023456019`).
- Admin → `admin123` / `admin123` (se cambia en el `.env` del backend: `ADMIN_USUARIO`, `ADMIN_PASSWORD`).

Stack: **FastAPI + Supabase** (backend) y **React + Vite** con estilos inline (frontend), igual que Relevamiento de Precios.

---

## 1. Base de datos (Supabase)

1. Creá un proyecto en Supabase.
2. SQL Editor → pegá `backend/schema.sql` → **Run**.

## 2. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate     # en Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                # y completá SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET
uvicorn main:app --reload --port 8000
```

Documentación interactiva: http://localhost:8000/docs

### Cargar tus clientes de una (Excel o CSV)

El archivo necesita una columna de nombre (`Nombre`, `Razón social`, `Cliente` o `Farmacia`) y una de `NIT`:

```bash
python importar_clientes.py clientes.xlsx --prueba   # muestra qué haría, no guarda nada
python importar_clientes.py clientes.xlsx            # importa
```

Si un NIT ya existe, actualiza el nombre en vez de duplicarlo.

### Imágenes
Las imágenes se suben a **Cloudinary** (mismas variables que el otro proyecto). Si no las configurás, todo funciona igual salvo la subida de imágenes.

## 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8000
npm run dev                 # http://localhost:5173
```

**Logo:** reemplazá `frontend/src/assets/logo_proesa.png` por el logo real (mismo nombre y ruta). El que viene es provisorio.

## 4. Deploy en Render

**Backend (Web Service)**
- Root: `backend` · Build: `pip install -r requirements.txt` · Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Variables: las del `.env.example`, con `FRONTEND_ORIGINS=https://tu-frontend.onrender.com`

**Frontend (Static Site)**
- Root: `frontend` · Build: `npm install && npm run build` · Publish: `dist`
- Variable: `VITE_API_URL=https://tu-backend.onrender.com`

---

## API

| Método | Ruta | Rol |
|---|---|---|
| POST | `/api/auth/login` | público |
| GET | `/api/auth/me` | logueado |
| GET | `/api/productos/catalogo` | logueado (solo productos visibles, solo nombre/precio/descripción/imagen) |
| GET / POST | `/api/productos` | admin |
| GET / PUT / DELETE | `/api/productos/:id` | admin |
| POST / DELETE | `/api/productos/:id/imagen` | admin |
| GET / POST | `/api/clientes` | admin |
| PUT / DELETE | `/api/clientes/:id` | admin |

- Producto con **Visible = no** → no aparece en el catálogo del cliente, pero se conserva.
- Cliente con **Puede iniciar sesión = no** → no puede entrar, y si tenía la sesión abierta se le cierra en la siguiente acción.

## Estructura

```
backend/
  main.py               app + CORS + routers
  db.py                 cliente Supabase + normalización de nombre/NIT
  auth.py               login, JWT, dependencias get_usuario_actual / get_admin
  productos.py          catálogo + CRUD + imágenes
  clientes.py           CRUD de clientes
  importar_clientes.py  carga masiva desde Excel/CSV
  schema.sql            tablas
frontend/src/
  App.jsx               sesión + routing por estado
  api.js                tokens de diseño PROESA + fetch al backend
  components/Navbar.jsx, components/ui.jsx
  pages/Login.jsx, Catalogo.jsx, GestionProductos.jsx, GestionClientes.jsx
  assets/logo_proesa.png
```
