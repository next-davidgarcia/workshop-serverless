const xss = require('xss');

module.exports.sanitizeSlug = (string = '') => {
    const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;';
    const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------';
    const p = new RegExp(a.split('').join('|'), 'g');

    return string.toString().toLowerCase().trim()
        .replace(/\s+/g, '-') // Replace spaces with -
        .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
        .replace(/&/g, '-and-') // Replace & with 'and'
        .replace(/[^\w\-]+/g, '') // Remove all non-word characters
        .replace(/\-\-+/g, '-') // Replace multiple - with single -
        .replace(/^-+/, '') // Trim - from start of text
        .replace(/-+$/, '') // Trim - from end of text
};

function xssObject(item) {
    const type = typeof item;
    if (type === 'object') {
        if (Array.isArray(item)) {
            item.forEach((el, index) => {
               item[index] = xssObject(el);
            });
            return item;
        } else {
            const keys = Object.keys(item);
            keys.forEach((k) => {
                const value = item[k];
                item[k] = xssObject(value);
            });
            return item;
        }
    } else if (type === 'string') {
        return xss(item);
    } else {
        return item;
    }
}

module.exports.xss = xssObject;

module.exports.replaceMultiple = (str, flags = {}, prefix = '', suffix = '') => {
    for (let k in flags) {
        const replace = prefix + k + suffix;
        const replace2 = prefix + ' ' + k + ' ' + suffix;
        str = str.replace(new RegExp(replace, 'g'), flags[k]);
        str = str.replace(new RegExp(replace2, 'g'), flags[k]);
    }
    return str;
};

module.exports.random = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
};

module.exports.zeroFill = (number, width) => {
    width -= number.toString().length;
    if ( width > 0 ) {
        return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
    }
    return number + ''; // always return a string
};
