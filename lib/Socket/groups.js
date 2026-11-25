import { proto } from '../../WAProto/index.js';
import { WAMessageAddressingMode, WAMessageStubType } from '../Types/index.js';
import { generateMessageIDV2, unixTimestampSeconds } from '../Utils/index.js';
import { areJidsSameUser, getBinaryNodeChild, getBinaryNodeChildren, getBinaryNodeChildString, isLidUser, isPnUser, jidEncode, jidNormalizedUser } from '../WABinary/index.js';
import { makeChatsSocket } from './chats.js';
import { createVenexvoraRequestOptimizer } from '../addons/venexvora-request-optimizer.js';
import { createVenexvoraSmartRetry } from '../addons/venexvora-smart-retry.js';
import { createVenexvoraActionLock } from '../addons/venexvora-action-lock.js';
import { createVenexvoraActionVerifier } from '../addons/venexvora-action-verifier.js';
export const makeGroupsSocket = (config) => {
    const sock = makeChatsSocket(config);
    const { authState, ev, query, upsertMessage } = sock;

    const groupMetadataOptimizer =
        createVenexvoraRequestOptimizer({
            ttlMs: 15_000,
            maxEntries: 500,
            cleanupIntervalMs: 60_000
        });

    const groupMetadataKey =
        (jid) => `venexvora:group-metadata:${jid}`;

    const invalidateGroupMetadata =
        (jid) => {
            if (!jid) {
                return false;
            }

            return groupMetadataOptimizer.invalidate(
                groupMetadataKey(jid)
            );
        };
    const groupQuery = async (jid, type, content) => query({
        tag: 'iq',
        attrs: {
            type,
            xmlns: 'w:g2',
            to: jid
        },
        content
    });
    const groupActionLock =
        createVenexvoraActionLock();

    const groupActionRetry =
        createVenexvoraSmartRetry({
            maxAttempts: 3,
            baseDelayMs: 250,
            maxDelayMs: 1000,
            jitterRatio: 0.15
        });

    const groupActionKey =
        (jid) =>
            `venexvora:group-action:${jid}`;

    const runGroupAction =
        (jid, factory) =>
            groupActionLock.run(
                groupActionKey(jid),
                factory
            );

    const runRetryableGroupQuery =
        (jid, type, content) =>
            groupActionRetry.run(
                () =>
                    groupQuery(
                        jid,
                        type,
                        content
                    )
            );
    const groupMetadata = async (jid) => {
        return groupMetadataOptimizer.getOrCreate(
            groupMetadataKey(jid),
            async () => {
                const result = await groupQuery(
                    jid,
                    'get',
                    [
                        {
                            tag: 'query',
                            attrs: {
                                request: 'interactive'
                            }
                        }
                    ]
                );

                return extractGroupMetadata(result);
            }
        );
    };
    const groupActionVerifier =
        createVenexvoraActionVerifier({
            maxAttempts: 5,
            intervalMs: 200
        });

    const verifyGroupMetadata =
        (jid, predicate, message) =>
            groupActionVerifier.assert(
                () => groupMetadata(jid),
                predicate,
                {
                    continueOnFetchError: true,
                    beforeAttempt: () => {
                        invalidateGroupMetadata(jid);
                    },
                    message
                }
            );

    const isGroupSettingVerified =
        (metadata, setting) => {
            switch (setting) {
                case 'announcement':
                    return metadata?.announce === true;
                case 'not_announcement':
                    return metadata?.announce === false;
                case 'locked':
                    return metadata?.restrict === true;
                case 'unlocked':
                    return metadata?.restrict === false;
                default:
                    return false;
            }
        };

    const isMemberAddModeVerified =
        (metadata, mode) =>
            metadata?.memberAddMode ===
            (mode === 'all_member_add');

    const isJoinApprovalModeVerified =
        (metadata, mode) =>
            metadata?.joinApprovalMode ===
            (mode === 'on');

    const isEphemeralVerified =
        (
            metadata,
            ephemeralExpiration
        ) => {
            const expected =
                Number(
                    ephemeralExpiration
                );

            const actual =
                metadata?.ephemeralDuration;

            if (
                !Number.isFinite(
                    expected
                )
            ) {
                return false;
            }

            if (expected <= 0) {
                return (
                    actual === undefined ||
                    actual === null ||
                    Number(actual) === 0
                );
            }

            return (
                Number(actual) ===
                expected
            );
        };

    const participantJidMatches =
        (participant, targetJid) => {
            if (
                !participant ||
                !targetJid
            ) {
                return false;
            }

            const candidates = [
                participant.id,
                participant.phoneNumber,
                participant.lid
            ].filter(Boolean);

            const normalizedTarget =
                jidNormalizedUser(
                    targetJid
                );

            return candidates.some(
                candidate => {
                    const normalizedCandidate =
                        jidNormalizedUser(
                            candidate
                        );

                    return (
                        normalizedCandidate ===
                            normalizedTarget ||
                        areJidsSameUser(
                            candidate,
                            targetJid
                        )
                    );
                }
            );
        };

    const findGroupParticipant =
        (metadata, targetJid) =>
            metadata?.participants?.find(
                participant =>
                    participantJidMatches(
                        participant,
                        targetJid
                    )
            );

    const isGroupParticipantAdmin =
        (participant) =>
            participant?.admin ===
                'admin' ||
            participant?.admin ===
                'superadmin';

    const isParticipantActionVerified =
        (
            metadata,
            targetJids,
            action
        ) => {
            if (
                !Array.isArray(targetJids) ||
                targetJids.length === 0
            ) {
                return true;
            }

            return targetJids.every(
                targetJid => {
                    const participant =
                        findGroupParticipant(
                            metadata,
                            targetJid
                        );

                    switch (action) {
                        case 'add':
                            return Boolean(
                                participant
                            );

                        case 'remove':
                            return !participant;

                        case 'promote':
                            return (
                                Boolean(
                                    participant
                                ) &&
                                isGroupParticipantAdmin(
                                    participant
                                )
                            );

                        case 'demote':
                            return (
                                Boolean(
                                    participant
                                ) &&
                                !isGroupParticipantAdmin(
                                    participant
                                )
                            );

                        default:
                            return false;
                    }
                }
            );
        };

    ev.on('groups.update', (updates) => {
        for (const update of updates || []) {
            if (update?.id) {
                invalidateGroupMetadata(
                    update.id
                );
            }
        }
    });

    ev.on(
        'group-participants.update',
        (update) => {
            if (update?.id) {
                invalidateGroupMetadata(
                    update.id
                );
            }
        }
    );

    ev.on(
        'connection.update',
        (update) => {
            if (update?.connection === 'close') {
                groupMetadataOptimizer.close();
            }
        }
    );

    const groupFetchAllParticipating = async () => {
        const result = await query({
            tag: 'iq',
            attrs: {
                to: '@g.us',
                xmlns: 'w:g2',
                type: 'get'
            },
            content: [
                {
                    tag: 'participating',
                    attrs: {},
                    content: [
                        { tag: 'participants', attrs: {} },
                        { tag: 'description', attrs: {} }
                    ]
                }
            ]
        });
        const data = {};
        const groupsChild = getBinaryNodeChild(result, 'groups');
        if (groupsChild) {
            const groups = getBinaryNodeChildren(groupsChild, 'group');
            for (const groupNode of groups) {
                const meta = extractGroupMetadata({
                    tag: 'result',
                    attrs: {},
                    content: [groupNode]
                });
                data[meta.id] = meta;
            }
        }
        // TODO: properly parse LID / PN DATA
        sock.ev.emit('groups.update', Object.values(data));
        return data;
    };
    sock.ws.on('CB:ib,,dirty', async (node) => {
        const { attrs } = getBinaryNodeChild(node, 'dirty');
        if (attrs.type !== 'groups') {
            return;
        }
        await groupFetchAllParticipating();
        await sock.cleanDirtyBits('groups');
    });
    return {
        ...sock,
        groupMetadata,
        groupCreate: async (subject, participants) => {
            const key = generateMessageIDV2();
            const result = await groupQuery('@g.us', 'set', [
                {
                    tag: 'create',
                    attrs: {
                        subject,
                        key
                    },
                    content: participants.map(jid => ({
                        tag: 'participant',
                        attrs: { jid }
                    }))
                }
            ]);
            return extractGroupMetadata(result);
        },
        groupLeave: async (id) => {
            return runGroupAction(
                id,
                async () => {
                    await groupQuery('@g.us', 'set', [
                        {
                            tag: 'leave',
                            attrs: {},
                            content: [
                                {
                                    tag: 'group',
                                    attrs: { id }
                                }
                            ]
                        }
                    ]);
                    invalidateGroupMetadata(id);
                }
            );
        },
        groupUpdateSubject: async (jid, subject) => {
            return runGroupAction(
                jid,
                async () => {
                    await runRetryableGroupQuery(
                        jid,
                        'set',
                        [
                            {
                                tag: 'subject',
                                attrs: {},
                                content:
                                    Buffer.from(
                                        subject,
                                        'utf-8'
                                    )
                            }
                        ]
                    );
                    invalidateGroupMetadata(jid);
                    await verifyGroupMetadata(
                        jid,
                        metadata =>
                            metadata?.subject === subject,
                        'groupUpdateSubject verification failed'
                    );
                }
            );
        },
        groupRequestParticipantsList: async (jid) => {
            const result = await groupQuery(jid, 'get', [
                {
                    tag: 'membership_approval_requests',
                    attrs: {}
                }
            ]);
            const node = getBinaryNodeChild(result, 'membership_approval_requests');
            const participants = getBinaryNodeChildren(node, 'membership_approval_request');
            return participants.map(v => v.attrs);
        },
        groupRequestParticipantsUpdate: async (jid, participants, action) => {
            return runGroupAction(
                jid,
                async () => {
                    const result =
                        await groupQuery(
                            jid,
                            'set',
                            [
                                {
                                    tag:
                                        'membership_requests_action',
                                    attrs: {},
                                    content: [
                                        {
                                            tag: action,
                                            attrs: {},
                                            content:
                                                participants.map(
                                                    jid => ({
                                                        tag:
                                                            'participant',
                                                        attrs:
                                                            { jid }
                                                    })
                                                )
                                        }
                                    ]
                                }
                            ]
                        );

                    invalidateGroupMetadata(jid);

                    const node =
                        getBinaryNodeChild(
                            result,
                            'membership_requests_action'
                        );

                    const nodeAction =
                        getBinaryNodeChild(
                            node,
                            action
                        );

                    const participantsAffected =
                        getBinaryNodeChildren(
                            nodeAction,
                            'participant'
                        );

                    return participantsAffected.map(
                        p => ({
                            status:
                                p.attrs.error ||
                                '200',
                            jid:
                                p.attrs.jid
                        })
                    );
                }
            );
        },
        groupParticipantsUpdate: async (jid, participants, action) => {
            return runGroupAction(
                jid,
                async () => {
                    const result =
                        await groupQuery(
                            jid,
                            'set',
                            [
                                {
                                    tag: action,
                                    attrs: {},
                                    content:
                                        participants.map(
                                            jid => ({
                                                tag:
                                                    'participant',
                                                attrs:
                                                    { jid }
                                            })
                                        )
                                }
                            ]
                        );

                    invalidateGroupMetadata(jid);

                    const node =
                        getBinaryNodeChild(
                            result,
                            action
                        );

                    const participantsAffected =
                        getBinaryNodeChildren(
                            node,
                            'participant'
                        );

                    const participantResults =
                        participantsAffected.map(
                            p => ({
                                status:
                                    p.attrs.error ||
                                    '200',
                                jid:
                                    p.attrs.jid,
                                content: p
                            })
                        );

                    const verifiableActions = [
                        'add',
                        'remove',
                        'promote',
                        'demote'
                    ];

                    const successfulJids =
                        participantResults
                            .filter(
                                participant =>
                                    String(
                                        participant.status
                                    ) === '200' &&
                                    participant.jid
                            )
                            .map(
                                participant =>
                                    participant.jid
                            );

                    if (
                        successfulJids.length > 0 &&
                        verifiableActions.includes(
                            action
                        )
                    ) {
                        await verifyGroupMetadata(
                            jid,
                            metadata =>
                                isParticipantActionVerified(
                                    metadata,
                                    successfulJids,
                                    action
                                ),
                            `groupParticipantsUpdate ${action} verification failed`
                        );
                    }

                    return participantResults;
                }
            );
        },
        groupUpdateDescription: async (jid, description) => {
            return runGroupAction(
                jid,
                async () => {
                    const metadata =
                        await groupMetadata(jid);

                    const prev =
                        metadata.descId ??
                        null;

                    const descriptionId =
                        description
                            ? generateMessageIDV2()
                            : null;

                    const content = [
                        {
                            tag: 'description',
                            attrs: {
                                ...(description
                                    ? {
                                        id:
                                            descriptionId
                                    }
                                    : {
                                        delete:
                                            'true'
                                    }),
                                ...(prev
                                    ? { prev }
                                    : {})
                            },
                            content:
                                description
                                    ? [
                                        {
                                            tag:
                                                'body',
                                            attrs: {},
                                            content:
                                                Buffer.from(
                                                    description,
                                                    'utf-8'
                                                )
                                        }
                                    ]
                                    : undefined
                        }
                    ];

                    await runRetryableGroupQuery(
                        jid,
                        'set',
                        content
                    );

                    invalidateGroupMetadata(jid);
                    await verifyGroupMetadata(
                        jid,
                        metadata =>
                            (metadata?.desc ?? '') ===
                            (description ?? ''),
                        'groupUpdateDescription verification failed'
                    );
                }
            );
        },
        groupInviteCode: async (jid) => {
            const result = await groupQuery(jid, 'get', [{ tag: 'invite', attrs: {} }]);
            const inviteNode = getBinaryNodeChild(result, 'invite');
            return inviteNode?.attrs.code;
        },
        groupRevokeInvite: async (jid) => {
            const result = await groupQuery(jid, 'set', [{ tag: 'invite', attrs: {} }]);
            const inviteNode = getBinaryNodeChild(result, 'invite');
            return inviteNode?.attrs.code;
        },
        groupAcceptInvite: async (code) => {
            const results = await groupQuery('@g.us', 'set', [{ tag: 'invite', attrs: { code } }]);
            const result = getBinaryNodeChild(results, 'group');
            return result?.attrs.jid;
        },
        /**
         * revoke a v4 invite for someone
         * @param groupJid group jid
         * @param invitedJid jid of person you invited
         * @returns true if successful
         */
        groupRevokeInviteV4: async (groupJid, invitedJid) => {
            const result = await groupQuery(groupJid, 'set', [
                { tag: 'revoke', attrs: {}, content: [{ tag: 'participant', attrs: { jid: invitedJid } }] }
            ]);
            return !!result;
        },
        /**
         * accept a GroupInviteMessage
         * @param key the key of the invite message, or optionally only provide the jid of the person who sent the invite
         * @param inviteMessage the message to accept
         */
        groupAcceptInviteV4: ev.createBufferedFunction(async (key, inviteMessage) => {
            key = typeof key === 'string' ? { remoteJid: key } : key;
            const results = await groupQuery(inviteMessage.groupJid, 'set', [
                {
                    tag: 'accept',
                    attrs: {
                        code: inviteMessage.inviteCode,
                        expiration: inviteMessage.inviteExpiration.toString(),
                        admin: key.remoteJid
                    }
                }
            ]);
            // if we have the full message key
            // update the invite message to be expired
            if (key.id) {
                // create new invite message that is expired
                inviteMessage = proto.Message.GroupInviteMessage.fromObject(inviteMessage);
                inviteMessage.inviteExpiration = 0;
                inviteMessage.inviteCode = '';
                ev.emit('messages.update', [
                    {
                        key,
                        update: {
                            message: {
                                groupInviteMessage: inviteMessage
                            }
                        }
                    }
                ]);
            }
            // generate the group add message
            await upsertMessage({
                key: {
                    remoteJid: inviteMessage.groupJid,
                    id: generateMessageIDV2(sock.user?.id),
                    fromMe: false,
                    participant: key.remoteJid
                },
                messageStubType: WAMessageStubType.GROUP_PARTICIPANT_ADD,
                messageStubParameters: [JSON.stringify(authState.creds.me)],
                participant: key.remoteJid,
                messageTimestamp: unixTimestampSeconds()
            }, 'notify');
            return results.attrs.from;
        }),
        groupGetInviteInfo: async (code) => {
            const results = await groupQuery('@g.us', 'get', [{ tag: 'invite', attrs: { code } }]);
            return extractGroupMetadata(results);
        },
        groupToggleEphemeral: async (jid, ephemeralExpiration) => {
            return runGroupAction(
                jid,
                async () => {
                    const content =
                        ephemeralExpiration
                            ? {
                                tag:
                                    'ephemeral',
                                attrs: {
                                    expiration:
                                        ephemeralExpiration
                                            .toString()
                                }
                            }
                            : {
                                tag:
                                    'not_ephemeral',
                                attrs: {}
                            };

                    await runRetryableGroupQuery(
                        jid,
                        'set',
                        [content]
                    );

                    invalidateGroupMetadata(jid);

                    await verifyGroupMetadata(
                        jid,
                        metadata =>
                            isEphemeralVerified(
                                metadata,
                                ephemeralExpiration
                            ),
                        'groupToggleEphemeral verification failed'
                    );
                }
            );
        },
        groupSettingUpdate: async (jid, setting) => {
            return runGroupAction(
                jid,
                async () => {
                    await runRetryableGroupQuery(
                        jid,
                        'set',
                        [
                            {
                                tag: setting,
                                attrs: {}
                            }
                        ]
                    );

                    invalidateGroupMetadata(jid);
                    await verifyGroupMetadata(
                        jid,
                        metadata =>
                            isGroupSettingVerified(
                                metadata,
                                setting
                            ),
                        'groupSettingUpdate verification failed'
                    );
                }
            );
        },
        groupMemberAddMode: async (jid, mode) => {
            return runGroupAction(
                jid,
                async () => {
                    await runRetryableGroupQuery(
                        jid,
                        'set',
                        [
                            {
                                tag:
                                    'member_add_mode',
                                attrs: {},
                                content: mode
                            }
                        ]
                    );

                    invalidateGroupMetadata(jid);
                    await verifyGroupMetadata(
                        jid,
                        metadata =>
                            isMemberAddModeVerified(
                                metadata,
                                mode
                            ),
                        'groupMemberAddMode verification failed'
                    );
                }
            );
        },
        groupJoinApprovalMode: async (jid, mode) => {
            return runGroupAction(
                jid,
                async () => {
                    await runRetryableGroupQuery(
                        jid,
                        'set',
                        [
                            {
                                tag:
                                    'membership_approval_mode',
                                attrs: {},
                                content: [
                                    {
                                        tag:
                                            'group_join',
                                        attrs: {
                                            state:
                                                mode
                                        }
                                    }
                                ]
                            }
                        ]
                    );

                    invalidateGroupMetadata(jid);
                    await verifyGroupMetadata(
                        jid,
                        metadata =>
                            isJoinApprovalModeVerified(
                                metadata,
                                mode
                            ),
                        'groupJoinApprovalMode verification failed'
                    );
                }
            );
        },
        groupFetchAllParticipating
    };
};
export const extractGroupMetadata = (result) => {
    const group = getBinaryNodeChild(result, 'group');
    const descChild = getBinaryNodeChild(group, 'description');
    let desc;
    let descId;
    let descOwner;
    let descOwnerPn;
    let descOwnerUsername;
    let descTime;
    if (descChild) {
        desc = getBinaryNodeChildString(descChild, 'body');
        descOwner = descChild.attrs.participant ? jidNormalizedUser(descChild.attrs.participant) : undefined;
        descOwnerPn = descChild.attrs.participant_pn ? jidNormalizedUser(descChild.attrs.participant_pn) : undefined;
        descOwnerUsername = descChild.attrs.participant_username || undefined;
        descTime = +descChild.attrs.t;
        descId = descChild.attrs.id;
    }
    const groupId = group.attrs.id.includes('@') ? group.attrs.id : jidEncode(group.attrs.id, 'g.us');
    const eph = getBinaryNodeChild(group, 'ephemeral')?.attrs.expiration;
    const memberAddMode = getBinaryNodeChildString(group, 'member_add_mode') === 'all_member_add';
    const metadata = {
        id: groupId,
        notify: group.attrs.notify,
        addressingMode: group.attrs.addressing_mode === 'lid' ? WAMessageAddressingMode.LID : WAMessageAddressingMode.PN,
        subject: group.attrs.subject,
        subjectOwner: group.attrs.s_o,
        subjectOwnerPn: group.attrs.s_o_pn,
        subjectOwnerUsername: group.attrs.s_o_username,
        subjectTime: +group.attrs.s_t,
        size: group.attrs.size ? +group.attrs.size : getBinaryNodeChildren(group, 'participant').length,
        creation: +group.attrs.creation,
        owner: group.attrs.creator ? jidNormalizedUser(group.attrs.creator) : undefined,
        ownerPn: group.attrs.creator_pn ? jidNormalizedUser(group.attrs.creator_pn) : undefined,
        ownerUsername: group.attrs.creator_username || undefined,
        owner_country_code: group.attrs.creator_country_code,
        desc,
        descId,
        descOwner,
        descOwnerPn,
        descOwnerUsername,
        descTime,
        linkedParent: getBinaryNodeChild(group, 'linked_parent')?.attrs.jid || undefined,
        restrict: !!getBinaryNodeChild(group, 'locked'),
        announce: !!getBinaryNodeChild(group, 'announcement'),
        isCommunity: !!getBinaryNodeChild(group, 'parent'),
        isCommunityAnnounce: !!getBinaryNodeChild(group, 'default_sub_group'),
        joinApprovalMode: !!getBinaryNodeChild(group, 'membership_approval_mode'),
        memberAddMode,
        participants: getBinaryNodeChildren(group, 'participant').map(({ attrs }) => {
            // TODO: Store LID MAPPINGS
            return {
                id: attrs.jid,
                phoneNumber: isLidUser(attrs.jid) && isPnUser(attrs.phone_number) ? attrs.phone_number : undefined,
                lid: isPnUser(attrs.jid) && isLidUser(attrs.lid) ? attrs.lid : undefined,
                username: attrs.participant_username || attrs.username || undefined,
                admin: (attrs.type || null)
            };
        }),
        ephemeralDuration: eph ? +eph : undefined
    };
    return metadata;
};

