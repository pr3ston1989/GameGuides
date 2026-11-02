const sharp = require('sharp');
const fs = require('node:fs/promises');
(async () => {
  await sharp('assets/icon.svg').resize(512).png().toFile('assets/icon.png');
  const {default: ico} = await import('png-to-ico');
  await fs.writeFile('assets/icon.ico', await ico('assets/icon.png'));
})();
