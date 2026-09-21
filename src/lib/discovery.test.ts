import { expect } from "chai";
import { UDP_KEY } from "tuyapi/lib/config";
import { CommandType, MessageParser } from "tuyapi/lib/message-parser";
import { parseBroadcast } from "./discovery";

const PAYLOAD = {
    ip: "192.168.1.50",
    gwId: "bf0123456789abcdefgh",
    active: 2,
    encrypt: true,
    productKey: "keyabc",
    version: "3.3",
};

function broadcast(version: string, encrypted: boolean): Buffer {
    const parser = new MessageParser({ key: UDP_KEY, version });
    return parser.encode({ data: PAYLOAD, encrypted, commandByte: CommandType.UDP_NEW, sequenceN: 0 });
}

describe("discovery => parseBroadcast", () => {
    it("parses an encrypted v3.3 presence broadcast (UDP 6667)", () => {
        expect(parseBroadcast(broadcast("3.3", true))).to.deep.equal({
            id: "bf0123456789abcdefgh",
            ip: "192.168.1.50",
            version: "3.3",
            productKey: "keyabc",
        });
    });

    it("parses a plain v3.1 presence broadcast (UDP 6666)", () => {
        expect(parseBroadcast(broadcast("3.1", false))?.ip).to.equal("192.168.1.50");
    });

    it("ignores foreign datagrams", () => {
        expect(parseBroadcast(Buffer.from("hello world, this is no tuya packet"))).to.equal(null);
    });
});
