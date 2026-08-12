# Puesta a punto de Supabase

Se hace **una sola vez**. Después de esto la app tiene base, usuaria y claves.

---

## 1. Crear el proyecto

1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta (o entrá con GitHub).
2. **New project**. Te va a pedir:
   - **Name**: `pileta` (o lo que quieras, no lo ve nadie).
   - **Database Password**: generala con el botón y **guardala en un lugar seguro**.
     No la usa la app — es para conectarse a Postgres directo. Si la perdés se puede
     resetear, pero mejor no.
   - **Region**: **South America (São Paulo)**. Es la más cercana; desde Argentina
     son ~30 ms contra ~150 ms de las de Estados Unidos. En una app que hace muchas
     consultas chicas, se nota.
   - **Plan**: Free.
3. Tarda entre uno y tres minutos en levantar. Esperá a que el ícono deje de girar.

---

## 2. Aplicar las migraciones

Los archivos están en `supabase/migrations/` y se aplican por fecha:

1. [`20260812120000_esquema_inicial.sql`](migrations/20260812120000_esquema_inicial.sql)
2. [`20260812180000_docentes_lista_espera.sql`](migrations/20260812180000_docentes_lista_espera.sql)

Si el proyecto ya estaba funcionando, la primera ya está aplicada: ejecutá
**solamente la segunda**. Esa migración crea Docentes y Lista de espera, y convierte
automáticamente en docentes titulares los nombres que ya tienen las clases.

**Camino corto (recomendado):**

1. Copiá la migración que corresponda entera al portapapeles. Para la nueva, en
   PowerShell y desde la carpeta del proyecto:

   ```powershell
   Get-Content "supabase\migrations\20260812180000_docentes_lista_espera.sql" -Raw | Set-Clipboard
   ```

2. En el panel de Supabase: **SQL Editor** → **New query** → pegá → **Run**
   (o `Ctrl+Enter`).
3. Tiene que decir **Success. No rows returned**. Si tira error, copiame el mensaje
   tal cual.

**Cómo saber que quedó bien:** andá a **Table Editor**. Tienen que estar las siete
tablas — `clientes`, `clases`, `participantes`, `pagos`, `asistencias`, `docentes`,
`lista_espera` — y cada una
con un cartelito verde que dice **RLS enabled**. Si alguna dice "RLS disabled" o
sale un banner rojo de "unrestricted", avisame: sin RLS los datos quedan a la vista
de cualquiera que tenga la URL.

---

## 3. Crear tu usuaria (a mano, una sola vez)

La app no tiene pantalla de registro a propósito. La usuaria se crea desde el panel:

1. **Authentication** → **Users** → botón **Add user** → **Create new user**.
2. Email y contraseña. Van a ser las que use la dueña para entrar, así que usá el
   mail real de ella.
3. **Importante: marcá `Auto Confirm User`.** Si no lo marcás, Supabase le manda un
   mail de confirmación y hasta que no lo abra no puede entrar — y el mail de
   prueba de Supabase a veces cae en spam.

---

## 4. Cerrar el registro público

Que exista una usuaria no impide que cualquiera se cree la suya. Hay que apagarlo:

1. **Authentication** → **Sign In / Providers** (según la versión del panel puede
   figurar como **Providers** → **Email**).
2. Buscá el switch **Allow new users to sign up** y **apagalo**.

Desde ese momento, cualquier intento de registro rebota. Para agregar a alguien más
en el futuro, se hace desde el panel como en el paso 3.

---

## 5. Copiar las claves a la app

1. **Project Settings** (el engranaje) → **API Keys** (o **API**, según la versión).
2. Copiá dos cosas:
   - **Project URL** → va en `VITE_SUPABASE_URL`
   - **anon** / **public** key → va en `VITE_SUPABASE_ANON_KEY`
3. En la carpeta del proyecto, creá `.env.local` a partir del ejemplo:

   ```powershell
   Copy-Item .env.example .env.local
   ```

4. Abrí `.env.local` y completá los cuatro valores: las dos claves de arriba, más el
   email y la contraseña del paso 3 en `SUPABASE_EMAIL_PRUEBA` y
   `SUPABASE_PASSWORD_PRUEBA` (las usa la verificación para probar con sesión).

> **La `anon key` es pública por diseño.** Viaja al navegador y se ve en el bundle;
> así se usa. Lo que protege los datos es RLS, no el secreto de esa clave.
>
> **La `service_role` no se toca.** Esa sí es secreta, saltea RLS entera y no va ni
> en el navegador ni en el repo ni en un mensaje de chat. Si alguna vez se filtra,
> hay que rotarla desde el panel.

`.env.local` está en `.gitignore`: no se sube nunca.

---

## 6. Verificar

```powershell
npm run verificar:base
```

Corre 5 secciones contra la base real: que sin sesión no se lee ni una fila, que lo
que se guarda vuelve igual (fechas incluidas, sin correrse un día), que el upsert
del importador actualiza en vez de duplicar, que un pago no puede tener cuenta y
recibo a la vez, y que las cascadas respetan la asimetría del historial.

---

## Plan gratuito: se pausa solo

Si el proyecto queda **una semana sin ninguna consulta**, Supabase lo pausa. La app
va a mostrar errores de red como si estuviera rota, pero no lo está.

**Cómo se despierta:** entrás al panel del proyecto y le das **Restore** /
**Resume**. Tarda un par de minutos y vuelve todo, sin pérdida de datos.

Con la dueña usándolo a diario esto no debería pasar nunca. Es un problema de los
períodos largos sin actividad — vacaciones, por ejemplo.
