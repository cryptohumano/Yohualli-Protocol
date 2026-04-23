import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"

const HubCreateProbeModule = buildModule("HubCreateProbeModule", (m) => {
  const probe = m.contract("HubCreateProbe")
  return { probe }
})

export default HubCreateProbeModule
