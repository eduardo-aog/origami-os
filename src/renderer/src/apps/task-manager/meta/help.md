## Procesos

Muestra los procesos del sistema, las aplicaciones abiertas y los controladores de los periféricos, con su PID, su **estado**, el uso de CPU y la memoria. Haz clic en una columna para ordenar. Las cifras son simuladas.

Para cerrar una aplicación que no responde, selecciónala y usa **Forzar cierre**. Se te avisará de que puedes perder datos y, si tenía cambios sin guardar, se te preguntará si quieres guardarlos. Los procesos del sistema no se pueden cerrar.

## Estados

Cada proceso pasa por cinco estados: **Nuevo**, **Listo**, **En ejecución**, **En espera** y **Terminado**. {{os}} reparte la CPU entre sus núcleos por turnos (*round-robin*): un proceso que agota su quantum y tiene a otros esperando vuelve a la cola de listos.

Aquí ves cuántos procesos hay en cada estado, qué ejecuta cada núcleo, la cola de listos y un registro con cada transición y su motivo. Puedes pausar la simulación, avanzarla paso a paso, acelerarla y crear procesos de prueba para ver cómo compiten por la CPU.

## Sincronización

Los recursos compartidos (el bus del disco, los canales de audio y el búfer de pantalla) se protegen con un **mutex** o un **semáforo**. Quien no consigue el recurso pasa a *En espera* y entra en su cola; cuando se libera, lo recibe el primero de la cola.

El **laboratorio de interbloqueo** crea dos hilos que piden dos recursos en orden contrario hasta que se bloquean. {{os}} detecta el ciclo y te deja romperlo terminando a uno de los hilos.

## Rendimiento

Gráficas de CPU, memoria y actividad del disco de los últimos 60 segundos, y el espacio ocupado del disco. El espacio de tus archivos es el real del sistema de archivos virtual; el resto es simulado.

## Periféricos

Conecta y desconecta dispositivos ficticios (teclado, mouse, audífonos, memorias USB…). Cada conexión aparece en el registro, avisa con una notificación y crea el proceso de su controlador en la lista de procesos. Hay 4 puertos USB: si están ocupados hay que desconectar algo antes.
