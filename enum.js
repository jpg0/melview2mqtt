class EnumBase {
    static enumValueOf(s) {
        return Object.entries(this)
            .filter(([k,v]) => k == s)
            .map(([k,v]) => v)
            .pop();
    }

    static enumById(id) {
        return Object.values(this)
            .filter(v => id == v.id)
            .pop();
    }
}

class Enum extends EnumBase {
    toString() {
        return Object.entries(this.constructor)
            .filter(([k,v]) => v == this)
            .map(([k,v]) => k)
            .pop();
    }
}

module.exports = {
    Enum
}