import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { ltiPlatforms, ltiLaunches, users, organizationMembers } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requireOrgRole } from '../middleware/organization';
import type { AppEnv } from '../types';

export const ltiRoutes = new Hono<AppEnv>();

// =============================================================================
// LTI 1.3 CONFIGURATION ENDPOINTS
// =============================================================================

/**
 * Get platform registration URL and configuration for admins setting up LTI
 * Returns the URLs that need to be entered into the LMS
 */
ltiRoutes.get('/config', (c) => {
  const baseUrl = process.env.API_BASE_URL || 'https://api.kairos.dev';

  return c.json({
    success: true,
    data: {
      // URLs to provide to the LMS administrator
      oidcInitiationUrl: `${baseUrl}/api/v1/lti/login`,
      targetLinkUri: `${baseUrl}/api/v1/lti/launch`,
      deepLinkingUrl: `${baseUrl}/api/v1/lti/deep-linking`,
      jwksUrl: `${baseUrl}/api/v1/lti/jwks`,

      // LTI 1.3 required parameters
      ltiVersion: '1.3.0',
      deploymentId: 'kairos-lti-deployment-1',

      // Supported messages
      supportedMessages: [
        {
          type: 'LtiResourceLinkRequest',
          targetLinkUri: `${baseUrl}/api/v1/lti/launch`,
        },
        {
          type: 'LtiDeepLinkingRequest',
          targetLinkUri: `${baseUrl}/api/v1/lti/deep-linking`,
        },
      ],

      // Supported services
      supportedServices: [
        'Assignment and Grade Services v2.0',
        'Names and Role Provisioning Services v2.0',
      ],

      // Required scopes
      requiredScopes: [
        'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
        'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
        'https://purl.imsglobal.org/spec/lti-ags/scope/score',
        'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
      ],
    },
  });
});

/**
 * JWKS endpoint for LTI platform to verify our signatures
 * In production, this should serve actual RSA public keys
 */
ltiRoutes.get('/jwks', async (c) => {
  // In production, generate and serve real RSA keys
  // For now, return a placeholder that indicates keys need configuration
  return c.json({
    keys: [
      {
        kty: 'RSA',
        alg: 'RS256',
        use: 'sig',
        kid: 'kairos-lti-key-1',
        // In production: n, e values from actual RSA public key
        n: 'REPLACE_WITH_ACTUAL_PUBLIC_KEY_MODULUS',
        e: 'AQAB',
      },
    ],
  });
});

// =============================================================================
// PLATFORM REGISTRATION (Admin)
// =============================================================================

/**
 * Register a new LTI platform (LMS)
 * Called by organization admins to set up their LMS connection
 */
ltiRoutes.post('/platforms', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    organizationId: string;
    name: string;
    issuer: string;
    clientId: string;
    authLoginUrl: string;
    authTokenUrl: string;
    keySetUrl: string;
    publicKey?: string;
  }>();

  // Verify user is org admin
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, body.organizationId),
      eq(organizationMembers.userId, user.id)
    ),
  });

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }

  // Check if platform with this issuer already exists for the org
  const existing = await db.query.ltiPlatforms.findFirst({
    where: and(
      eq(ltiPlatforms.organizationId, body.organizationId),
      eq(ltiPlatforms.issuer, body.issuer)
    ),
  });

  if (existing) {
    return c.json({
      success: false,
      error: 'Platform with this issuer already registered for organization'
    }, 400);
  }

  const [platform] = await db
    .insert(ltiPlatforms)
    .values({
      organizationId: body.organizationId,
      name: body.name,
      issuer: body.issuer,
      clientId: body.clientId,
      authLoginUrl: body.authLoginUrl,
      authTokenUrl: body.authTokenUrl,
      keySetUrl: body.keySetUrl,
      publicKey: body.publicKey,
    })
    .returning();

  return c.json({
    success: true,
    data: {
      id: platform.id,
      name: platform.name,
      issuer: platform.issuer,
      clientId: platform.clientId,
      isActive: platform.isActive,
      createdAt: platform.createdAt,
    },
  });
});

/**
 * List all LTI platforms for an organization
 */
ltiRoutes.get('/platforms', requireAuth, async (c) => {
  const user = c.get('user');
  const organizationId = c.req.query('organizationId');

  if (!organizationId) {
    return c.json({ success: false, error: 'organizationId required' }, 400);
  }

  // Verify user is org member
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, user.id)
    ),
  });

  if (!membership) {
    return c.json({ success: false, error: 'Not a member of this organization' }, 403);
  }

  const platforms = await db.query.ltiPlatforms.findMany({
    where: eq(ltiPlatforms.organizationId, organizationId),
    columns: {
      id: true,
      name: true,
      issuer: true,
      clientId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return c.json({
    success: true,
    data: platforms,
  });
});

/**
 * Update an LTI platform
 */
ltiRoutes.patch('/platforms/:platformId', requireAuth, async (c) => {
  const user = c.get('user');
  const platformId = c.req.param('platformId');
  const body = await c.req.json<{
    name?: string;
    authLoginUrl?: string;
    authTokenUrl?: string;
    keySetUrl?: string;
    publicKey?: string;
    isActive?: boolean;
  }>();

  const platform = await db.query.ltiPlatforms.findFirst({
    where: eq(ltiPlatforms.id, platformId),
  });

  if (!platform) {
    return c.json({ success: false, error: 'Platform not found' }, 404);
  }

  // Verify user is org admin
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, platform.organizationId),
      eq(organizationMembers.userId, user.id)
    ),
  });

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }

  const [updated] = await db
    .update(ltiPlatforms)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(ltiPlatforms.id, platformId))
    .returning();

  return c.json({
    success: true,
    data: {
      id: updated.id,
      name: updated.name,
      issuer: updated.issuer,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt,
    },
  });
});

/**
 * Delete an LTI platform
 */
ltiRoutes.delete('/platforms/:platformId', requireAuth, async (c) => {
  const user = c.get('user');
  const platformId = c.req.param('platformId');

  const platform = await db.query.ltiPlatforms.findFirst({
    where: eq(ltiPlatforms.id, platformId),
  });

  if (!platform) {
    return c.json({ success: false, error: 'Platform not found' }, 404);
  }

  // Verify user is org admin
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, platform.organizationId),
      eq(organizationMembers.userId, user.id)
    ),
  });

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }

  await db.delete(ltiPlatforms).where(eq(ltiPlatforms.id, platformId));

  return c.json({ success: true });
});

// =============================================================================
// LTI 1.3 LAUNCH FLOW
// =============================================================================

/**
 * OIDC Login Initiation - Step 1 of LTI 1.3 launch
 * LMS redirects user here to start the authentication flow
 */
ltiRoutes.get('/login', async (c) => {
  const iss = c.req.query('iss'); // Issuer (LMS)
  const loginHint = c.req.query('login_hint');
  const targetLinkUri = c.req.query('target_link_uri');
  const ltiMessageHint = c.req.query('lti_message_hint');
  const clientId = c.req.query('client_id');

  if (!iss || !loginHint || !targetLinkUri) {
    return c.json({
      success: false,
      error: 'Missing required parameters: iss, login_hint, target_link_uri',
    }, 400);
  }

  // Find the platform by issuer
  const platform = await db.query.ltiPlatforms.findFirst({
    where: and(
      eq(ltiPlatforms.issuer, iss),
      eq(ltiPlatforms.isActive, true)
    ),
  });

  if (!platform) {
    return c.json({
      success: false,
      error: 'LTI platform not registered or inactive',
    }, 404);
  }

  // Generate state and nonce for security
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();

  // Store the launch state temporarily
  await db.insert(ltiLaunches).values({
    platformId: platform.id,
    userId: null, // Will be set after successful launch
    ltiUserId: loginHint,
    state,
    nonce,
    status: 'pending',
    launchData: {
      targetLinkUri,
      ltiMessageHint,
      clientId,
    } as any,
  });

  // Build the authentication request URL
  const authParams = new URLSearchParams({
    scope: 'openid',
    response_type: 'id_token',
    response_mode: 'form_post',
    client_id: clientId || platform.clientId,
    redirect_uri: targetLinkUri,
    login_hint: loginHint,
    state,
    nonce,
    prompt: 'none',
  });

  if (ltiMessageHint) {
    authParams.set('lti_message_hint', ltiMessageHint);
  }

  const authUrl = `${platform.authLoginUrl}?${authParams.toString()}`;

  return c.redirect(authUrl);
});

/**
 * LTI Launch Endpoint - Step 2 of LTI 1.3 launch
 * Receives the id_token after OIDC authentication
 */
ltiRoutes.post('/launch', async (c) => {
  const formData = await c.req.parseBody();
  const idToken = formData['id_token'] as string;
  const state = formData['state'] as string;

  if (!idToken || !state) {
    return c.json({
      success: false,
      error: 'Missing id_token or state',
    }, 400);
  }

  // Find the pending launch by state
  const launch = await db.query.ltiLaunches.findFirst({
    where: and(
      eq(ltiLaunches.state, state),
      eq(ltiLaunches.status, 'pending')
    ),
    with: {
      platform: true,
    },
  });

  if (!launch) {
    return c.json({
      success: false,
      error: 'Invalid or expired launch state',
    }, 400);
  }

  // In production: Verify JWT signature using platform's public key
  // For now, decode the JWT payload (base64)
  const [, payloadBase64] = idToken.split('.');
  let payload: any;

  try {
    payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
  } catch {
    return c.json({
      success: false,
      error: 'Invalid id_token format',
    }, 400);
  }

  // Verify nonce
  if (payload.nonce !== launch.nonce) {
    return c.json({
      success: false,
      error: 'Invalid nonce',
    }, 400);
  }

  // Extract LTI claims
  const ltiClaims = {
    messageType: payload['https://purl.imsglobal.org/spec/lti/claim/message_type'],
    version: payload['https://purl.imsglobal.org/spec/lti/claim/version'],
    deploymentId: payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
    targetLinkUri: payload['https://purl.imsglobal.org/spec/lti/claim/target_link_uri'],
    resourceLink: payload['https://purl.imsglobal.org/spec/lti/claim/resource_link'],
    context: payload['https://purl.imsglobal.org/spec/lti/claim/context'],
    roles: payload['https://purl.imsglobal.org/spec/lti/claim/roles'] || [],
    ags: payload['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'],
    nrps: payload['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice'],
  };

  // Find or create user by LTI user ID and email
  const email = payload.email;
  const name = payload.name || payload.given_name || 'LTI User';

  let user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    // Create new user from LTI data
    [user] = await db
      .insert(users)
      .values({
        email,
        name,
        emailVerified: true, // Trust the LMS
        authProvider: 'lti',
        authProviderId: payload.sub,
      })
      .returning();

    // Add user to organization if platform has one
    if (launch.platform.organizationId) {
      // Determine role based on LTI roles
      const isInstructor = ltiClaims.roles.some((role: string) =>
        role.includes('Instructor') || role.includes('Administrator')
      );

      await db.insert(organizationMembers).values({
        organizationId: launch.platform.organizationId,
        userId: user.id,
        role: isInstructor ? 'instructor' : 'member',
      });
    }
  }

  // Update the launch record
  await db
    .update(ltiLaunches)
    .set({
      userId: user.id,
      ltiContextId: ltiClaims.context?.id,
      ltiResourceLinkId: ltiClaims.resourceLink?.id,
      ltiUserName: name,
      ltiUserEmail: email,
      ltiRoles: ltiClaims.roles as any,
      ltiLineItemUrl: ltiClaims.ags?.lineitem,
      status: 'completed',
      launchData: {
        ...launch.launchData as object,
        claims: ltiClaims,
        ags: ltiClaims.ags,
        nrps: ltiClaims.nrps,
      } as any,
    })
    .where(eq(ltiLaunches.id, launch.id));

  // Generate a session token and redirect to the app
  // In production, create a proper session/JWT
  const sessionToken = crypto.randomUUID();
  const appUrl = process.env.APP_URL || 'https://app.kairos.dev';

  // Redirect based on message type
  if (ltiClaims.messageType === 'LtiDeepLinkingRequest') {
    return c.redirect(`${appUrl}/lti/deep-linking?session=${sessionToken}&launchId=${launch.id}`);
  }

  // Default: redirect to main app with context
  const redirectUrl = new URL(`${appUrl}/learn`);
  redirectUrl.searchParams.set('lti', 'true');
  redirectUrl.searchParams.set('session', sessionToken);
  redirectUrl.searchParams.set('context', ltiClaims.context?.id || '');

  return c.redirect(redirectUrl.toString());
});

// =============================================================================
// DEEP LINKING
// =============================================================================

/**
 * Deep Linking Response - Returns content items to embed in LMS
 */
ltiRoutes.post('/deep-linking/response', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    launchId: string;
    items: Array<{
      type: 'ltiResourceLink' | 'link' | 'html';
      title: string;
      url?: string;
      html?: string;
      customParams?: Record<string, string>;
    }>;
  }>();

  const launch = await db.query.ltiLaunches.findFirst({
    where: and(
      eq(ltiLaunches.id, body.launchId),
      eq(ltiLaunches.userId, user.id)
    ),
    with: {
      platform: true,
    },
  });

  if (!launch) {
    return c.json({ success: false, error: 'Launch not found' }, 404);
  }

  const launchData = launch.launchData as any;
  const claims = launchData?.claims;

  if (!claims || claims.messageType !== 'LtiDeepLinkingRequest') {
    return c.json({
      success: false,
      error: 'Not a deep linking launch'
    }, 400);
  }

  // Build content items response
  const contentItems = body.items.map((item) => {
    if (item.type === 'ltiResourceLink') {
      return {
        type: 'ltiResourceLink',
        title: item.title,
        url: item.url,
        custom: item.customParams,
      };
    } else if (item.type === 'link') {
      return {
        type: 'link',
        title: item.title,
        url: item.url,
      };
    } else {
      return {
        type: 'html',
        title: item.title,
        html: item.html,
      };
    }
  });

  // In production: Sign this as a JWT and return a form that auto-submits
  // For now, return the data that would be included
  return c.json({
    success: true,
    data: {
      // This would be a signed JWT in production
      deepLinkingResponse: {
        iss: process.env.API_BASE_URL || 'https://api.kairos.dev',
        aud: launch.platform.issuer,
        exp: Math.floor(Date.now() / 1000) + 300,
        iat: Math.floor(Date.now() / 1000),
        nonce: crypto.randomUUID(),
        'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingResponse',
        'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
        'https://purl.imsglobal.org/spec/lti/claim/deployment_id': claims.deploymentId,
        'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': contentItems,
      },
      returnUrl: launchData.claims?.['https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings']?.deep_link_return_url,
    },
  });
});

// =============================================================================
// ASSIGNMENT AND GRADE SERVICES (AGS)
// =============================================================================

/**
 * Submit a grade back to the LMS
 */
ltiRoutes.post('/grades', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    launchId: string;
    scoreGiven: number;
    scoreMaximum: number;
    comment?: string;
    activityProgress: 'Initialized' | 'Started' | 'InProgress' | 'Submitted' | 'Completed';
    gradingProgress: 'FullyGraded' | 'Pending' | 'PendingManual' | 'Failed' | 'NotReady';
  }>();

  const launch = await db.query.ltiLaunches.findFirst({
    where: and(
      eq(ltiLaunches.id, body.launchId),
      eq(ltiLaunches.userId, user.id)
    ),
    with: {
      platform: true,
    },
  });

  if (!launch) {
    return c.json({ success: false, error: 'Launch not found' }, 404);
  }

  const launchData = launch.launchData as any;
  const agsEndpoint = launchData?.ags;

  if (!agsEndpoint?.lineitem) {
    return c.json({
      success: false,
      error: 'Grade passback not available for this launch'
    }, 400);
  }

  // Build score payload per LTI AGS spec
  const scorePayload = {
    userId: launch.ltiUserId,
    scoreGiven: body.scoreGiven,
    scoreMaximum: body.scoreMaximum,
    comment: body.comment,
    timestamp: new Date().toISOString(),
    activityProgress: body.activityProgress,
    gradingProgress: body.gradingProgress,
  };

  // In production: Get access token and POST to LMS
  // This requires OAuth 2.0 client credentials flow with the platform

  // For now, return what would be sent
  return c.json({
    success: true,
    data: {
      message: 'Grade submission prepared',
      endpoint: `${agsEndpoint.lineitem}/scores`,
      payload: scorePayload,
      note: 'In production, this would POST to the LMS with proper OAuth authentication',
    },
  });
});

// =============================================================================
// NAMES AND ROLE PROVISIONING SERVICE (NRPS)
// =============================================================================

/**
 * Get class roster from LMS
 */
ltiRoutes.get('/roster/:launchId', requireAuth, async (c) => {
  const user = c.get('user');
  const launchId = c.req.param('launchId');

  const launch = await db.query.ltiLaunches.findFirst({
    where: eq(ltiLaunches.id, launchId),
    with: {
      platform: true,
    },
  });

  if (!launch) {
    return c.json({ success: false, error: 'Launch not found' }, 404);
  }

  // Verify user has instructor role for this launch
  const ltiRoles = launch.ltiRoles as string[];
  const isInstructor = ltiRoles.some((role) =>
    role.includes('Instructor') || role.includes('Administrator')
  );

  if (!isInstructor) {
    return c.json({
      success: false,
      error: 'Only instructors can access roster'
    }, 403);
  }

  const launchData = launch.launchData as any;
  const nrpsEndpoint = launchData?.nrps;

  if (!nrpsEndpoint?.context_memberships_url) {
    return c.json({
      success: false,
      error: 'Roster service not available for this launch'
    }, 400);
  }

  // In production: Get access token and fetch roster from LMS
  return c.json({
    success: true,
    data: {
      message: 'Roster fetch prepared',
      endpoint: nrpsEndpoint.context_memberships_url,
      note: 'In production, this would GET from the LMS with proper OAuth authentication',
    },
  });
});

// =============================================================================
// LAUNCH HISTORY
// =============================================================================

/**
 * Get LTI launch history for current user
 */
ltiRoutes.get('/launches', requireAuth, async (c) => {
  const user = c.get('user');
  const limit = parseInt(c.req.query('limit') || '20', 10);

  const launches = await db.query.ltiLaunches.findMany({
    where: eq(ltiLaunches.userId, user.id),
    orderBy: (launches, { desc }) => [desc(launches.createdAt)],
    limit,
    with: {
      platform: {
        columns: {
          name: true,
          issuer: true,
        },
      },
    },
    columns: {
      id: true,
      ltiContextId: true,
      ltiResourceLinkId: true,
      status: true,
      createdAt: true,
    },
  });

  return c.json({
    success: true,
    data: launches,
  });
});

export { ltiRoutes };
