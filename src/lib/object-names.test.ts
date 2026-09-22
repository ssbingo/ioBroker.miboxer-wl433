import { expect } from "chai";
import { LANGUAGES, OBJECT_NAMES, objectName } from "./object-names";
import { BASE_OBJECTS, lightChannel, zoneChannelObjects, zoneSelectorState } from "./objects";

describe("object-names => translations", () => {
    for (const [key, names] of Object.entries(OBJECT_NAMES)) {
        it(`"${key}" has a text in every admin language`, () => {
            expect(Object.keys(names)).to.have.members([...LANGUAGES]);
            for (const language of LANGUAGES) {
                expect(names[language].trim(), language).to.not.equal("");
            }
        });

        it(`"${key}" uses the placeholder in all languages or in none`, () => {
            const withPlaceholder = LANGUAGES.filter(language => names[language].includes("{0}"));
            expect(withPlaceholder.length, withPlaceholder.join(",")).to.be.oneOf([0, LANGUAGES.length]);
        });
    }

    it("replaces the placeholder", () => {
        expect(objectName("zone", 3)).to.include({ en: "Zone 3", de: "Zone 3", pl: "Strefa 3", "zh-cn": "区域 3" });
        expect(objectName("brightness").fr).to.equal("Luminosité");
    });
});

describe("object-names => objects of the adapter", () => {
    // the ioBroker repository checker (E6001) expects every translated common.name in all admin languages
    const definitions = [
        ...BASE_OBJECTS,
        lightChannel("selector"),
        lightChannel("channels"),
        zoneSelectorState(),
        ...zoneChannelObjects(),
    ];

    it("gives every object a name in all admin languages", () => {
        for (const { id, obj } of definitions) {
            const name = obj.common?.name;
            expect(name, id).to.be.an("object");
            expect(Object.keys(name as object), id).to.have.members([...LANGUAGES]);
        }
    });
});
