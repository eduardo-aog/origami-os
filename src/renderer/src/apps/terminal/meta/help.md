## El prompt

Cada línea empieza con `usuario@sistema:ruta$`. Escribe una orden y pulsa `Enter`. Con las flechas arriba y abajo recorres el historial, y con `Tab` se completan órdenes y rutas.

## Órdenes disponibles

- `help` lista todas las órdenes.
- `ls [-l]`, `cd`, `pwd` y `tree` para moverte y ver carpetas.
- `mkdir [-p]`, `touch`, `cp [-r]`, `mv` y `rm [-r]` para crear, copiar, mover y borrar. `rm` envía a la papelera.
- `cat` muestra un archivo y `echo` imprime texto; con `>` y `>>` lo escribe en un archivo.
- `open` abre un archivo con su aplicación predeterminada.
- `python archivo.py [argumentos]` o `python -c "código"` ejecuta un programa de Python (también `python3`).
- `date`, `whoami`, `history` y `clear`.

Los cambios se reflejan al instante en {{app:files}} y en el escritorio. `Ctrl+L` limpia la pantalla y `Ctrl+C` cancela la línea o corta el programa de Python que esté corriendo.

No hay tuberías, `&&` ni comodines.

## Python

Es Python real (CPython en WebAssembly) con su biblioteca estándar: `math`, `json`, `random`, `datetime`, `re`, `collections`… La primera vez que lo usas tarda unos segundos en cargar. Escribe un programa con {{app:text-editor}} (un archivo `.py`) y ejecútalo con `python programa.py`.

Límites que conviene conocer:

- No hay `pip` ni acceso a la red: solo la biblioteca estándar.
- `input()` no está disponible: al llamarlo termina con `EOFError`. Pasa los datos como argumentos (`sys.argv`).
- `open()` de Python **no ve** los archivos del sistema: trabaja en una memoria temporal que se borra al terminar el programa. Para guardar el resultado, redirige la salida con `>` o `>>`.
- Solo corre un programa a la vez.
