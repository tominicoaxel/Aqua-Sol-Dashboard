# Dashboard Pileta

Panel de gestión para una pileta privada. Permite administrar clientes, cuotas,
clases, participantes y asistencias, e importar el padrón desde Excel o CSV.

Los datos viven en **Supabase** (Postgres + Auth) y están protegidos con RLS. La
aplicación requiere iniciar sesión y no ofrece registro público.

## Requisitos

- Node.js y npm
- Un proyecto de Supabase configurado
- Una usuaria creada manualmente en Supabase

La configuración completa de la base, la migración, RLS, el alta de la usuaria y
el cierre del registro público están explicados paso a paso en
[`supabase/LEEME.md`](supabase/LEEME.md).

## Configuración local

1. Instalá las dependencias:

   ```powershell
   npm install
   ```

2. Creá el archivo local de variables de entorno:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Completá `.env.local` con los datos de **Project Settings → API Keys** de
   Supabase:

   ```dotenv
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   SUPABASE_EMAIL_PRUEBA=
   SUPABASE_PASSWORD_PRUEBA=
   ```

   Las dos variables `VITE_*` son necesarias para ejecutar la app. El email y la
   contraseña se usan solamente en las verificaciones contra la base real.

   `.env.local` contiene credenciales y está ignorado por Git. La `anon key` es
   pública por diseño y queda protegida por RLS; la clave `service_role` no debe
   copiarse al proyecto ni exponerse en el navegador.

4. Levantá la aplicación:

   ```powershell
   npm run dev
   ```

   Vite la sirve por defecto en <http://localhost:5173>.

## Crear la usuaria y cerrar el registro

La app no tiene pantalla de registro a propósito. En el panel de Supabase:

1. Abrí **Authentication → Users → Add user → Create new user**.
2. Ingresá el email y la contraseña de la persona que va a usar la app.
3. Activá **Auto Confirm User**.
4. Abrí **Authentication → Sign In / Providers → Email** y desactivá
   **Allow new users to sign up**.

Las usuarias adicionales también se crean manualmente desde el panel. Consultá
[`supabase/LEEME.md`](supabase/LEEME.md) si los nombres de las opciones cambiaron
en la interfaz de Supabase.

## Comandos

```powershell
npm run dev                  # desarrollo
npm run build                # build de producción en dist/
npm run verificar            # todos los chequeos, incluida la base real
npm run verificar:base       # esquema, RLS y persistencia en Supabase
npm run verificar:importador # importador y regeneración de ejemplos/
npm run preview              # vista local del build
```

`npm run verificar` comprueba el render SSR de todas las pantallas, las
mutaciones puras, el importador, el esquema y las políticas RLS, y el ciclo de
persistencia contra Supabase. Si faltan credenciales, los bloques que requieren
la base se omiten con un aviso explícito.

## Importar desde Excel

El importador acepta `.xlsx` y `.csv` y guía por cuatro pasos: subir, emparejar
columnas, revisar y confirmar. Tolera encabezados alternativos, formatos de fecha
habituales en Argentina, importes con separadores y CSV en UTF-8 o Windows-1252.

La importación agrega y actualiza por nombre normalizado, pero **nunca borra**.
Las filas problemáticas se informan para que ninguna persona desaparezca en
silencio. En `ejemplos/` hay tres archivos de prueba.

## Persistencia y seguridad

- Cada usuaria accede únicamente a sus filas mediante políticas RLS.
- Los IDs se generan en el cliente para conservar las mutaciones puras de la app.
- Los pagos, participantes y asistencias se guardan en Supabase.
- El estado se actualiza de forma optimista y se revierte si falla la escritura.
- El registro público permanece cerrado; no hay formulario de alta en la app.
- Nunca se debe usar ni versionar una clave `service_role`.

## Si la app deja de conectarse

En el plan gratuito, Supabase puede **pausar automáticamente el proyecto después
de una semana sin actividad**. En ese caso la app puede mostrar un error de red,
pero los datos no se perdieron.

Para reactivarlo, entrá al panel de Supabase, abrí el proyecto y elegí **Restore**
o **Resume**. El arranque puede tardar unos minutos. Si el proyecto está activo,
revisá la conexión y las variables de `.env.local`.

## Despliegue

El proyecto se despliega como una aplicación **Vite**. En el proveedor de hosting
hay que definir para producción:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

No se sube `.env.local`. Tampoco hacen falta reglas de rewrite porque la app no
usa un router de cliente.
