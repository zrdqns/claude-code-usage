# consumo

Mod para [Claude Code](https://claude.com/claude-code): un tablero lateral con lo que la sesión lleva gastado.

```
12 min 5 s
de sesión · $3.51

Límite de 5 horas
reinicia en              4 h 0 min

Límite de 7 días               79%
━━━━━━━━━━━━━━━━━━━━━━━━━──────
reinicia en               3 d 2 h

Contexto                180k de 1M
mensajes                      142k
herramientas                   21k
sistema                        12k

Último turno
salida                        1.2k

Tokens                         45k
salida                         12k
entrada                        33k
servido de caché               92%

Herramientas                    18
Read                             7
Edit                             5
Bash                             4
```

## Qué muestra

- **Sesión**: tiempo transcurrido y costo acumulado.
- **Avisos**: desde el 80 % de contexto recomienda `/compact`, y avisa de cada límite que pase del 80 % (el de 5 horas se sigue en la franja).
- **Límites**: cada ventana de uso con su barra y cuándo reinicia.
- **Contexto**: tokens usados sobre la ventana y las tres categorías que más ocupan.
- **Último turno**: tokens de salida.
- **Tokens**: salida, entrada y qué parte de la entrada sirvió la caché.
- **Herramientas**: llamadas totales y las cinco más usadas.

El panel se abre solo al empezar la sesión; `/consumo` lo vuelve a abrir.

## Pensado para usarse con `franja`

Este panel no repite lo que ya muestra la franja sobre el prompt del mod [franja](https://github.com/zrdqns/claude-code-franja): el porcentaje de contexto, el porcentaje del límite de 5 horas y la duración y el costo del último turno están allí. Aquí queda el detalle que la franja no tiene.

## Instalación

En el prompt de una sesión de terminal:

```
/plugin install consumo --marketplace zrdqns/claude-code-consumo
```

Responde `y` para añadir el marketplace y elige el alcance (el de usuario lo carga en todas las sesiones, también en las de la app de escritorio).

Para probarlo desde una copia local, sin instalarlo:

```bash
claude --plugin-dir ./claude-code-consumo
```

## Desarrollo

```bash
claude plugin validate .
claude plugin test .
```

El módulo está en [`hooks/register.tsx`](hooks/register.tsx), su contrato de estado en [`types/index.d.ts`](types/index.d.ts) y los tests en [`tests/`](tests).

## Licencia

[MIT](LICENSE)
