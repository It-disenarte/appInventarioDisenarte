// Textos del asistente de uso. Cada paso apunta a un elemento con data-guide="<target>".
// Los pasos cuyo elemento no existe en pantalla se descartan al iniciar el recorrido,
// así que aquí se describen todos y la pantalla decide cuáles aplican.

const AREA = { produccion: 'Producción', diseno: 'Diseño' };

function areaRule(ctx) {
  if (ctx.role === 'admin' || ctx.role === 'super') return 'Con tu rol puedes consultar y modificar todos los inventarios.';
  return `Puedes consultar todos los inventarios, pero solo modificar los del área de ${AREA[ctx.role] || ctx.role}.`;
}

// Recorrido general: se muestra una vez por sesión, antes de la guía de la primera pantalla.
export function generalSteps(ctx) {
  return [
    {
      title: '¡Bienvenido a Inventario Diseñarte!',
      body: 'Con esta app se lleva el control de materiales, insumos y herramientas de cada área: cuánto hay, qué falta, qué está por caducar y quién movió qué. Este asistente te explica cada pantalla y para qué sirve cada botón.',
      note: 'Avanza con "Siguiente" o con las flechas del teclado. "Saltar" cierra la guía de esta pantalla. Si ya no la necesitas, marca "No volver a mostrar el asistente" abajo.',
    },
    {
      target: 'header-title', title: 'Dónde estás',
      body: 'La barra superior siempre te dice qué estás viendo: el punto de color y el nombre del inventario (grupo) seleccionado y, debajo, la vista actual (Artículos, Movimientos o Categorías).',
    },
    ...(!ctx.isWide ? [{
      target: 'menu-button', title: 'Botón de menú',
      body: 'Toca este botón para abrir el menú lateral. Desde ahí cambias de inventario, de vista y entras a tu perfil. Se cierra al elegir una opción, tocando fuera o con la ×.',
    }] : []),
    {
      target: 'menu-groups', menu: true, title: 'Inventarios',
      body: 'Cada elemento de esta lista es un inventario independiente (un grupo), por ejemplo "Producción · Insumos". El punto de color lo identifica en toda la app. Toca uno para ver su contenido.',
      note: areaRule(ctx),
    },
    {
      target: 'menu-views', menu: true, title: 'Vistas del inventario',
      body: 'Estas opciones cambian lo que ves del inventario seleccionado:',
      list: [
        ['Artículos', 'las existencias, organizadas por categoría. Aquí registras entradas y consumos.'],
        ...(ctx.canSeeMovements ? [['Movimientos', 'el historial de cada entrada y consumo: quién, cuándo y cuánto.']] : []),
        ['Categorías', 'cómo se agrupan los artículos, su unidad de medida y sus campos extra.'],
      ],
    },
    {
      target: 'menu-admin', menu: true, title: 'Administración',
      body: 'Opciones disponibles solo para ciertos roles:',
      list: [
        ...(ctx.canEditGroups ? [['Grupos', 'crear, renombrar, recolorear o eliminar inventarios y decidir qué área los modifica.']] : []),
        ...(ctx.isAdmin ? [['Usuarios', 'dar de alta a personas, asignarles un rol o darlas de baja.']] : []),
      ],
    },
    {
      target: 'menu-profile', menu: true, title: 'Mi perfil',
      body: 'Toca tu nombre para abrir tu perfil. Ahí ves tus datos y puedes activar o desactivar este asistente cuando quieras.',
    },
    {
      target: 'menu-logout', menu: true, title: 'Salir',
      body: 'Cierra tu sesión en este dispositivo. Si no sales, la sesión se mantiene abierta hasta 30 días y no tendrás que volver a escribir tu contraseña.',
    },
    {
      target: 'help-button', title: 'Ayuda en cualquier momento',
      body: 'Este botón vuelve a mostrar la guía de la pantalla en la que estés, aunque hayas desactivado el asistente.',
    },
  ];
}

const SECTION_STEPS = {
  inventarios: (ctx) => [
    {
      title: 'Pantalla de Artículos',
      body: `Aquí ves todo lo que hay en "${ctx.groupLabel || 'el inventario seleccionado'}", organizado por categorías. Sirve para consultar existencias y registrar lo que entra y lo que se consume.`,
    },
    ...(!ctx.canModify && ctx.hasGroups ? [{
      title: 'Modo consulta',
      body: `Este inventario pertenece al área de ${AREA[ctx.groupArea] || ctx.groupArea}. Puedes consultarlo, pero los botones para modificarlo solo aparecen para esa área y para los roles Súper y Admin.`,
    }] : []),
    {
      target: 'cat-heading', title: 'Categoría',
      body: 'Cada bloque empieza con el nombre de la categoría y su unidad de medida (por ejemplo "ACRÍLICOS · PIEZAS"). Todas las cantidades de los artículos de abajo están en esa unidad.',
    },
    {
      target: 'item-card', title: 'Tarjeta de artículo',
      body: 'Cada artículo muestra:',
      list: [
        ['Nombre', 'en negritas.'],
        ['Detalles', 'código, metraje, proveedor y las características propias de la categoría (si se capturaron).'],
        ['Descripción', 'texto libre con notas del artículo.'],
        ['Estado', '"Stock ok"; "Bajo mínimo" en ámbar cuando la cantidad es igual o menor al punto de reorden; "Agotado" cuando llega a 0. Es la señal para volver a comprar.'],
        ['Caducidad', 'en gris la fecha; en ámbar "Caduca en N días" a partir de 30 días antes; en rojo "Caduca hoy" o "Caducado".'],
      ],
    },
    {
      target: 'item-qty', title: 'Existencia actual',
      body: 'La cantidad disponible en este momento, con su unidad. Se actualiza al instante cuando alguien registra una entrada o un consumo.',
    },
    {
      target: 'item-minus', title: 'Registrar consumo (−)',
      body: 'Resta 1 a la existencia y guarda un movimiento de "Consumo" con tu nombre, la fecha y la hora. Úsalo cada vez que se toma material. Se desactiva cuando la existencia llega a 0.',
    },
    {
      target: 'item-plus', title: 'Registrar entrada (+)',
      body: 'Suma 1 a la existencia y guarda un movimiento de "Entrada". Úsalo cuando llega material nuevo o se devuelve algo al almacén.',
    },
    {
      target: 'item-edit', title: 'Editar artículo',
      body: 'Abre un formulario dentro de la tarjeta para corregir nombre, código, reorden, metraje, proveedor, fecha de caducidad, características y descripción. Pulsa "Guardar" para aplicar o "Cancelar" para salir sin cambios.',
      note: 'La cantidad no se edita aquí a propósito: siempre se cambia con − y + para que cada cambio quede registrado en Movimientos.',
    },
    {
      target: 'item-delete', title: 'Eliminar artículo',
      body: 'Borra el artículo y todo su historial de movimientos. Antes te pide confirmación. No se puede deshacer.',
    },
    {
      target: 'item-restock', title: 'Solicitar reabastecimiento',
      body: 'Aparece cuando un artículo está bajo mínimo o agotado. Crea una solicitud de compra en Zoho Projects (tablero DI-5 · Gestión de Compras y Materiales, columna "Solicitud") con los datos del artículo y tu nombre, y abre la tarea en Zoho. Cualquier usuario puede usarlo, aunque el inventario sea de otra área.',
      note: 'Pide confirmación antes de crearla. Recuerda: si la solicitud no está en ese tablero, no se compra.',
    },
    {
      target: 'item-restock-status', title: 'Solicitud en curso',
      body: 'El artículo ya tiene una solicitud abierta en Zoho, así que el botón no se repite. "Ver en Zoho" abre la tarea para revisar si ya está en Pedido, Tránsito o Entregado.',
      note: 'La solicitud se libera sola cuando registras la entrada del material y la existencia vuelve a superar el punto de reorden, o cuando la tarea se cierra en Zoho.',
    },
    {
      target: 'add-item', title: 'Agregar artículo',
      body: 'Abre el formulario para dar de alta un artículo nuevo en esta categoría. Campos:',
      list: [
        ['Nombre', 'obligatorio. Cómo lo identifica el equipo.'],
        ['Código', 'clave del proveedor, código interno o número del código de barras.'],
        ['Cantidad', 'existencia inicial. Si es mayor a 0 se registra como entrada.'],
        ['Reorden', 'cantidad mínima. Al llegar a ella el artículo se marca "Bajo mínimo".'],
        ['Metraje', 'medida del material, por ejemplo "1.22 x 50 m".'],
        ['Proveedor', 'a quién se le compra.'],
        ['Fecha de caducidad', 'activa los avisos de caducidad.'],
        ['Descripción', 'notas libres.'],
        ['Características', 'campos extra definidos en la categoría (p. ej. Color, Espesor).'],
      ],
    },
    ...(!ctx.hasCategories && ctx.hasGroups ? [{
      title: 'Aún no hay categorías',
      body: ctx.canModify
        ? 'Para agregar artículos primero crea una categoría: abre el menú y entra a "Categorías".'
        : 'Este inventario todavía no tiene categorías. Cuando el área responsable las cree, aquí verás sus artículos.',
    }] : []),
    ...(ctx.hasCategories && !ctx.hasItems && ctx.canModify ? [{
      title: 'Cuando haya artículos',
      body: 'Cada artículo tendrá botones − y + para registrar consumos y entradas, "Editar" para corregir sus datos y "Eliminar" para darlo de baja.',
    }] : []),
  ],

  movimientos: (ctx) => [
    {
      title: 'Pantalla de Movimientos',
      body: `Es el historial de todas las entradas y consumos de "${ctx.groupLabel || 'este inventario'}", del más reciente al más antiguo. Sirve para saber quién tomó o repuso material y cuándo. Solo los roles Súper y Admin pueden verla.`,
    },
    {
      target: 'mov-row', title: 'Un movimiento',
      body: 'Cada renglón muestra:',
      list: [
        ['Artículo', 'el nombre en negritas.'],
        ['Detalle', 'categoría · fecha y hora · persona que lo registró.'],
        ['Cambio', 'en turquesa "+N" para entradas y en magenta "−N" para consumos.'],
        ['Antes → después', 'la existencia antes y después del cambio.'],
      ],
    },
    {
      target: 'mov-delete', title: 'Eliminar movimiento',
      body: 'Borra solo este registro del historial; la existencia actual del artículo no cambia. Útil para limpiar un registro hecho por error. Pide confirmación.',
    },
    {
      target: 'mov-clear', title: 'Vaciar movimientos',
      body: 'Borra todo el historial del inventario que estás viendo (los demás inventarios no se tocan). Pide confirmación y no se puede deshacer. Se desactiva cuando no hay movimientos.',
    },
    ...(!ctx.hasMovements ? [{
      title: 'Aún no hay movimientos',
      body: 'En cuanto alguien use los botones − o + en Artículos, o dé de alta un artículo con cantidad inicial, el registro aparecerá aquí.',
    }] : []),
  ],

  categorias: (ctx) => [
    {
      title: 'Pantalla de Categorías',
      body: 'Las categorías ordenan los artículos de cada inventario (por ejemplo "Acrílicos" o "Viniles"). Cada una define su unidad de medida y, opcionalmente, campos extra llamados características.',
    },
    ...(!ctx.canModify && ctx.hasGroups ? [{
      title: 'Modo consulta',
      body: `Solo el área de ${AREA[ctx.groupArea] || ctx.groupArea}, Súper y Admin pueden crear o cambiar categorías de este inventario.`,
    }] : []),
    {
      target: 'cat-card', title: 'Una categoría',
      body: 'Muestra el nombre y, debajo, la unidad de medida, cuántos artículos tiene y sus características.',
    },
    {
      target: 'cat-edit', title: 'Editar categoría',
      body: 'Permite cambiar el nombre, la unidad y las características. Las características se escriben separadas por comas (p. ej. "Color, Espesor") y aparecen como campos al agregar o editar artículos de esta categoría.',
      note: 'Si quitas una característica, deja de mostrarse en los artículos.',
    },
    {
      target: 'cat-delete', title: 'Eliminar categoría',
      body: 'Borra la categoría junto con todos sus artículos y sus movimientos. Te avisa cuántos artículos se perderán y pide confirmación. No se puede deshacer.',
    },
    {
      target: 'cat-new', title: 'Nueva categoría',
      body: 'Escribe el nombre, la unidad (si la dejas vacía se usa "piezas") y, si quieres, las características separadas por comas. Pulsa "Agregar".',
    },
  ],

  grupos: () => [
    {
      title: 'Pantalla de Grupos',
      body: 'Cada grupo es un inventario independiente y aparece en el menú lateral bajo "Inventarios". Aquí se crean y configuran. Solo los roles Súper y Admin tienen acceso.',
    },
    {
      target: 'group-card', title: 'Un grupo',
      body: 'Muestra su color, su nombre, el área que puede modificarlo y cuántas categorías tiene.',
    },
    {
      target: 'group-edit', title: 'Editar grupo',
      body: 'Cambia el nombre, el color del punto que lo identifica y el área responsable.',
      list: [
        ['Producción', 'lo modifican los usuarios de Producción.'],
        ['Diseño', 'lo modifican los usuarios de Diseño.'],
      ],
      note: 'Súper y Admin siempre pueden modificar todos los grupos. Todos los usuarios pueden consultarlos.',
    },
    {
      target: 'group-delete', title: 'Eliminar grupo',
      body: 'Borra el inventario completo: sus categorías, artículos y movimientos. Te dice cuánto se va a borrar y pide confirmación. No se puede deshacer.',
    },
    {
      target: 'group-new', title: 'Nuevo grupo',
      body: 'Escribe el nombre (p. ej. "Producción · Herramienta"), elige un color y el área responsable, y pulsa "Agregar grupo". Aparecerá de inmediato en el menú.',
    },
  ],

  admin: () => [
    {
      title: 'Pantalla de Usuarios',
      body: 'Aquí se administra quién puede entrar a la app y qué puede hacer. Solo el rol Admin tiene acceso.',
    },
    {
      target: 'user-card', title: 'Un usuario',
      body: 'Muestra el nombre y el correo con el que inicia sesión. Tu propia cuenta aparece marcada con "(tú)".',
    },
    {
      target: 'user-roles', title: 'Roles',
      body: 'Toca un rol para asignarlo. El cambio aplica de inmediato, aunque la persona tenga la app abierta.',
      list: [
        ['Producción', 'consulta todo; modifica los inventarios del área de Producción.'],
        ['Diseño', 'consulta todo; modifica los inventarios del área de Diseño.'],
        ['Súper', 'modifica todos los inventarios, ve Movimientos y administra Grupos.'],
        ['Admin', 'todo lo anterior y además administra Usuarios.'],
      ],
      note: 'No puedes quitarte a ti mismo el rol Admin, para que la app nunca se quede sin administrador.',
    },
    {
      target: 'user-delete', title: 'Eliminar usuario',
      body: 'La persona ya no podrá entrar. Los movimientos que registró se conservan con su nombre. Pide confirmación. No puedes eliminar tu propia cuenta.',
    },
    {
      target: 'user-new', title: 'Nuevo usuario',
      body: 'Llena nombre, correo (con el que iniciará sesión) y contraseña; "Ver" muestra lo que escribes. Elige su rol y pulsa "Agregar usuario".',
      note: 'Comparte la contraseña con la persona por un medio privado.',
    },
  ],

  perfil: () => [
    {
      title: 'Mi perfil',
      body: 'Aquí ves los datos de tu cuenta y tus preferencias.',
    },
    {
      target: 'profile-data', title: 'Tus datos',
      body: 'Nombre, correo de acceso y rol. Si alguno es incorrecto, pide al administrador que lo corrija.',
    },
    {
      target: 'profile-guide', title: 'Asistente de uso',
      body: 'Activado: la guía de cada pantalla aparece cada vez que abres la app. Desactivado: no vuelve a aparecer. "Ver guía ahora" la vuelve a mostrar en cada pantalla durante esta sesión, sin cambiar tu preferencia.',
    },
  ],
};

export function sectionSteps(section, ctx) {
  const build = SECTION_STEPS[section];
  return build ? build(ctx) : [];
}
