// const {isSession} = require("./assistHelper");

const isSession = function (identity) {
    return identity === "session";
}

const isValidSession = function (query, filters) {
    if (!isSession(query.identity)) {
        return false;
    }
    if (!query.sessionInfo) {
        return false;
    }
    let sessionInfo = query.sessionInfo
    let foundAll = true;
    for (const [key, body] of Object.entries(filters)) {
        let found = false;
        if (body.values !== undefined && body.values !== null) {
            for (const [skey, svalue] of Object.entries(sessionInfo)) {
                if (svalue !== undefined && svalue !== null) {
                    if (typeof (svalue) === "object") {
                        if (isValidSession(svalue, {[key]: body})) {
                            found = true;
                            break;
                        }
                    } else if (skey.toLowerCase() === key.toLowerCase()) {
                        for (let v of body["values"]) {
                            if (body.operator === "is" && String(svalue).toLowerCase() === v.toLowerCase()
                                || body.operator !== "is" && String(svalue).toLowerCase().indexOf(v.toLowerCase()) >= 0) {
                                found = true;
                                break;
                            }
                        }
                        if (found) {
                            break;
                        }
                    }
                }
            }
        }
        foundAll = foundAll && found;
        if (!found) {
            break;
        }
    }
    return foundAll;
}

module.exports = {
    isValidSession: isValidSession
}