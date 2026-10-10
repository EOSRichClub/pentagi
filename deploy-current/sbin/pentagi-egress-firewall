#!/usr/bin/env bash
set -euo pipefail

network_name="${PENTAGI_EGRESS_NETWORK:-pentagi-egress}"
subnet="${PENTAGI_EGRESS_SUBNET:-172.29.0.0/24}"
gateway="${PENTAGI_EGRESS_GATEWAY:-172.29.0.1}"
bridge_name="${PENTAGI_EGRESS_BRIDGE:-br-pentagi-eg}"
redir_port="${PENTAGI_EGRESS_REDIR_PORT:-7892}"

if ! docker network inspect "$network_name" >/dev/null 2>&1; then
  docker network create \
    --driver bridge \
    --subnet "$subnet" \
    --gateway "$gateway" \
    --opt "com.docker.network.bridge.name=$bridge_name" \
    "$network_name" >/dev/null
fi

# Rebuild only our own chains. The jumps are added once and remain compatible
# with Docker recreating its own rules.
iptables -t nat -N PENTAGI_EGRESS_NAT 2>/dev/null || true
iptables -t nat -F PENTAGI_EGRESS_NAT
iptables -t nat -A PENTAGI_EGRESS_NAT -d "$subnet" -j RETURN
iptables -t nat -A PENTAGI_EGRESS_NAT -p tcp -j REDIRECT --to-ports "$redir_port"
iptables -t nat -C PREROUTING -i "$bridge_name" -j PENTAGI_EGRESS_NAT 2>/dev/null || \
  iptables -t nat -I PREROUTING 1 -i "$bridge_name" -j PENTAGI_EGRESS_NAT

iptables -N PENTAGI_EGRESS_GUARD 2>/dev/null || true
iptables -F PENTAGI_EGRESS_GUARD
iptables -A PENTAGI_EGRESS_GUARD -d "$subnet" -j ACCEPT
iptables -A PENTAGI_EGRESS_GUARD -j REJECT --reject-with icmp-admin-prohibited
iptables -C DOCKER-USER -s "$subnet" -j PENTAGI_EGRESS_GUARD 2>/dev/null || \
  iptables -I DOCKER-USER 1 -s "$subnet" -j PENTAGI_EGRESS_GUARD

# Mihomo listens on all local addresses so REDIRECT can reach it. Keep the
# listeners unavailable from the public NIC and every unrelated Docker bridge.
iptables -N PENTAGI_PROXY_INPUT 2>/dev/null || true
iptables -F PENTAGI_PROXY_INPUT
iptables -A PENTAGI_PROXY_INPUT -i lo -j ACCEPT
iptables -A PENTAGI_PROXY_INPUT -i "$bridge_name" -j ACCEPT
iptables -A PENTAGI_PROXY_INPUT -j REJECT --reject-with icmp-port-unreachable
for protocol in tcp udp; do
  iptables -C INPUT -p "$protocol" -m multiport --dports 7890,"$redir_port" \
    -j PENTAGI_PROXY_INPUT 2>/dev/null || \
    iptables -I INPUT 1 -p "$protocol" -m multiport --dports 7890,"$redir_port" \
      -j PENTAGI_PROXY_INPUT
done
