import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from 'wolfsocket';

import {
  getBotName,
  buildMenuHeader,
  createFakeContact,
  getMenuImageBuffer
} from './menuHelper.js';

import { isButtonModeEnabled } from './buttonMode.js';

import {
  ANIME,
  BRAND,
  ETHICAL,
  GAMES,
  GITHUB,
  MEDIA,
  SOCIAL,
  STALKER,
  STATUS,
  UI
} from './emojis.js';


/* =========================================================
 * BUTTON AVAILABILITY
 * ======================================================= */

export function isButtonMode() {
  return isButtonModeEnabled();
}

export function isWolfBtnsAvailable() {
  return (
    typeof generateWAMessageFromContent === 'function' &&
    !!proto
  );
}

/*
 * Compatibility export.
 *
 * antiedit.js imports this function, while the actual
 * button implementation uses wolfsocket/proto.
 */
export function isGiftedBtnsAvailable() {
  return isWolfBtnsAvailable();
}


/* =========================================================
 * SIMPLE BUTTON MENU
 * ======================================================= */

export async function sendButtonMenu(sock, jid, options = {}) {
  const {
    title = '',
    text = '',
    footer = '',
    buttons = [],
    image = null,
    quoted = null
  } = options;

  let fullText = '';

  if (title) {
    fullText += `*${title}*\n\n`;
  }

  fullText += text;

  if (footer) {
    fullText += `\n\n${footer}`;
  }

  /*
   * Keep compatibility with callers that provide buttons.
   * If native interactive buttons are unavailable, send text.
   */
  await sock.sendMessage(
    jid,
    { text: fullText },
    quoted ? { quoted } : {}
  );
}


/* =========================================================
 * INTERACTIVE MESSAGE WITH IMAGE / VIDEO
 * ======================================================= */

export async function sendInteractiveWithImage(
  sock,
  jid,
  {
    bodyText = '',
    footerText = '',
    buttons = [],
    imageBuffer = null,
    videoBuffer = null,
    mimetype = 'image/jpeg'
  } = {}
) {
  if (!generateWAMessageFromContent || !proto) {
    throw new Error(
      'wolfsocket interactive message support is not available'
    );
  }

  let headerObj = {
    title: '',
    subtitle: '',
    hasMediaAttachment: false
  };


  /* -------------------------------------------------------
   * Prepare media
   * ----------------------------------------------------- */

  if (
    (imageBuffer || videoBuffer) &&
    typeof prepareWAMessageMedia === 'function'
  ) {
    try {
      const mediaContent = videoBuffer
        ? {
            video: videoBuffer,
            gifPlayback: true,
            mimetype
          }
        : {
            image: imageBuffer,
            mimetype
          };

      const mediaMsg = await prepareWAMessageMedia(
        mediaContent,
        {
          upload: sock.waUploadToServer
        }
      );

      if (mediaMsg?.imageMessage) {
        headerObj = {
          title: '',
          subtitle: '',
          hasMediaAttachment: true,
          imageMessage: mediaMsg.imageMessage
        };
      }

      if (mediaMsg?.videoMessage) {
        headerObj = {
          title: '',
          subtitle: '',
          hasMediaAttachment: true,
          videoMessage: mediaMsg.videoMessage
        };
      }

    } catch (uploadErr) {
      console.log(
        '[ButtonHelper] Image/video upload failed, sending without media:',
        uploadErr?.message || uploadErr
      );
    }
  }


  /* -------------------------------------------------------
   * Normalize native buttons
   * ----------------------------------------------------- */

  const nativeButtons = Array.isArray(buttons)
    ? buttons.map((btn) => ({
        name: btn?.name || 'quick_reply',
        buttonParamsJson:
          typeof btn?.buttonParamsJson === 'string'
            ? btn.buttonParamsJson
            : JSON.stringify(btn?.buttonParamsJson || {})
      }))
    : [];


  /* -------------------------------------------------------
   * Build interactive message
   * ----------------------------------------------------- */

  const msgContent = {
    interactiveMessage:
      proto.Message.InteractiveMessage.create({
        header:
          proto.Message.InteractiveMessage.Header.create(
            headerObj
          ),

        body:
          proto.Message.InteractiveMessage.Body.create({
            text: String(bodyText || '')
          }),

        footer:
          proto.Message.InteractiveMessage.Footer.create({
            text: String(footerText || '')
          }),

        nativeFlowMessage:
          proto.Message.InteractiveMessage.NativeFlowMessage.create({
            buttons: nativeButtons,
            messageParamsJson: ''
          })
      })
  };


  /* -------------------------------------------------------
   * Native-flow stanza
   * ----------------------------------------------------- */

  const interactiveStanzaNodes = [
    {
      tag: 'biz',
      attrs: {},
      content: [
        {
          tag: 'interactive',
          attrs: {
            type: 'native_flow',
            v: '1'
          },
          content: [
            {
              tag: 'native_flow',
              attrs: {
                v: '9',
                name: 'mixed'
              }
            }
          ]
        }
      ]
    }
  ];


  /* -------------------------------------------------------
   * Generate + relay
   * ----------------------------------------------------- */

  try {
    const msg = generateWAMessageFromContent(
      jid,
      msgContent,
      {
        userJid: sock.user?.id
      }
    );

    if (!msg?.message || !msg?.key?.id) {
      throw new Error(
        'wolfsocket failed to generate interactive message'
      );
    }

    await sock.relayMessage(
      jid,
      msg.message,
      {
        messageId: msg.key.id,
        additionalNodes: interactiveStanzaNodes
      }
    );

    console.log(
      '[ButtonHelper] Interactive message sent successfully'
    );

    return msg;

  } catch (relayErr) {
    console.log(
      '[ButtonHelper] relayMessage failed:',
      relayErr?.message || relayErr
    );

    throw relayErr;
  }
}


/* =========================================================
 * MAIN MENU
 * ======================================================= */

export async function sendMainMenuButtons(
  sock,
  jid,
  m,
  PREFIX
) {
  const botName = getBotName();
  const fkontak = createFakeContact(m);

  const headerText = buildMenuHeader(
    `${BRAND.WOLF} MAIN MENU`,
    PREFIX
  );


  /* -------------------------------------------------------
   * Menu categories
   * ----------------------------------------------------- */

  const menuCategories = [
    {
      text: `${SOCIAL.BOT} AI`,
      id: `${PREFIX}aimenu`
    },
    {
      text: `${GITHUB.GITHUB} Anime`,
      id: `${PREFIX}animemenu`
    },
    {
      text: `${UI.SETTINGS} Auto`,
      id: `${PREFIX}automenu`
    },
    {
      text: `${MEDIA.DESIGN} Logo`,
      id: `${PREFIX}logomenu`
    },
    {
      text: `${UI.DOWNLOAD} Download`,
      id: `${PREFIX}downloadmenu`
    },
    {
      text: `${STATUS.SPARKLE} Ephoto`,
      id: `${PREFIX}ephotomenu`
    },
    {
      text: `${SOCIAL.SHIELD} Security`,
      id: `${PREFIX}securitymenu`
    },
    {
      text: `${UI.CELEBRATE} Fun`,
      id: `${PREFIX}funmenu`
    },
    {
      text: `${GAMES.GAMEPAD} Games`,
      id: `${PREFIX}gamemenu`
    },
    {
      text: `${GITHUB.GITHUB} GitHub`,
      id: `${PREFIX}gitmenu`
    },
    {
      text: `${UI.HOME} Group`,
      id: `${PREFIX}groupmenu`
    },
    {
      text: `${MEDIA.IMAGE} ImageGen`,
      id: `${PREFIX}imagemenu`
    },
    {
      text: `${UI.REFRESH} Media`,
      id: `${PREFIX}mediamenu`
    },
    {
      text: `${MEDIA.MUSIC} Music`,
      id: `${PREFIX}musicmenu`
    },
    {
      text: `${SOCIAL.CROWN} Owner`,
      id: `${PREFIX}ownermenu`
    },
    {
      text: `${UI.CAMERA} PhotoFunia`,
      id: `${PREFIX}photofunia`
    },
    {
      text: `${GAMES.TROPHY} Sports`,
      id: `${PREFIX}sportsmenu`
    },
    {
      text: `${STALKER.STALKER} Stalker`,
      id: `${PREFIX}stalkermenu`
    },
    {
      text: `${UI.TOOL} Tools`,
      id: `${PREFIX}toolsmenu`
    },
    {
      text: `${ANIME.U1F49D} Valentine`,
      id: `${PREFIX}valentinemenu`
    },
    {
      text: `${MEDIA.VIDEO} Videos`,
      id: `${PREFIX}videomenu`
    }
  ];


  let menuText =
    `${headerText}\n\n` +
    `${UI.CLIPBOARD} *Tap a button below to open a category:*`;


  /* -------------------------------------------------------
   * Create quick reply buttons
   * ----------------------------------------------------- */

  const interactiveButtons = menuCategories.map(
    (cat) => ({
      name: 'quick_reply',

      buttonParamsJson: JSON.stringify({
        display_text: cat.text,
        id: cat.id
      })
    })
  );


  /* All commands */

  interactiveButtons.push({
    name: 'quick_reply',

    buttonParamsJson: JSON.stringify({
      display_text: `${UI.DOCUMENT} All Commands`,
      id: `${PREFIX}menu2`
    })
  });


  /* Ping */

  interactiveButtons.push({
    name: 'quick_reply',

    buttonParamsJson: JSON.stringify({
      display_text: `${ETHICAL.PINGPONG} Ping`,
      id: `${PREFIX}ping`
    })
  });


  /* -------------------------------------------------------
   * Send menu with image
   * ----------------------------------------------------- */

  try {
    const media = await getMenuImageBuffer();

    const imageBuffer =
      media?.buffer || null;

    await sendInteractiveWithImage(
      sock,
      jid,
      {
        bodyText: menuText,

        footerText:
          `${BRAND.WOLF} ${botName}`,

        buttons: interactiveButtons,

        imageBuffer,

        mimetype: 'image/jpeg'
      }
    );

  } catch (err) {

    console.log(
      '[ButtonMenu] Interactive with image failed:',
      err?.message || err
    );


    /* -----------------------------------------------------
     * Text fallback
     * --------------------------------------------------- */

    let fallback =
      `${headerText}\n\n` +
      `${UI.CLIPBOARD} *Menu Categories:*\n\n`;


    menuCategories.forEach((cat) => {
      fallback +=
        `├─ ${cat.text} → *${cat.id}*\n`;
    });


    fallback +=
      `\n${UI.DOCUMENT} Full list: *${PREFIX}menu2*`;

    fallback +=
      `\n${ETHICAL.PINGPONG} Ping: *${PREFIX}ping*`;

    fallback +=
      `\n\n${BRAND.WOLF} *POWERED BY ${botName.toUpperCase()}* ${BRAND.WOLF}`;


    /* -----------------------------------------------------
     * Try image fallback
     * --------------------------------------------------- */

    try {
      const media =
        await getMenuImageBuffer();

      if (media?.buffer) {

        await sock.sendMessage(
          jid,
          {
            image: media.buffer,
            caption: fallback,
            mimetype: 'image/jpeg'
          },
          {
            quoted: fkontak
          }
        );

      } else {

        await sock.sendMessage(
          jid,
          {
            text: fallback
          },
          {
            quoted: fkontak
          }
        );
      }

    } catch {

      await sock.sendMessage(
        jid,
        {
          text: fallback
        },
        {
          quoted: fkontak
        }
      );
    }
  }
}


/* =========================================================
 * RESPONSE WITH BUTTONS
 * ======================================================= */

export async function sendResponseWithButtons(
  sock,
  jid,
  options = {},
  m = null
) {
  const {
    text = '',
    footer = '',
    buttons = [],
    image = null
  } = options;


  /*
   * Preserve the original behavior:
   * send a normal text message.
   *
   * The arguments are retained because other commands
   * may depend on this function's existing API.
   */
  await sock.sendMessage(
    jid,
    {
      text
    },
    m
      ? {
          quoted: m
        }
      : {}
  );
}
