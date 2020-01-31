import React from 'react';
import PropTypes from 'prop-types';
import { graphql } from 'react-apollo';
import { Box, Flex } from '@rebass/grid';
import { FormattedMessage } from 'react-intl';
import { withRouter } from 'next/router';

import { Router } from '../server/pages';
import { API_V2_CONTEXT, gqlV2 } from '../lib/graphql/helpers';
import { ssrNotFoundError } from '../lib/nextjs_utils';
import { withUser } from '../components/UserProvider';
import ErrorPage, { generateError } from '../components/ErrorPage';
import Loading from '../components/Loading';
import CollectiveThemeProvider from '../components/CollectiveThemeProvider';
import Container from '../components/Container';
import CollectiveNavbar from '../components/CollectiveNavbar';
import Page from '../components/Page';
import Link from '../components/Link';
import StyledLink from '../components/StyledLink';
import SignInOrJoinFree from '../components/SignInOrJoinFree';
import ContainerOverlay from '../components/ContainerOverlay';
import { Sections } from '../components/collective-page/_constants';
import hasFeature, { FEATURES } from '../lib/allowed-features';
import PageFeatureNotSupported from '../components/PageFeatureNotSupported';

class CreateExpensePage extends React.Component {
  static getInitialProps({ query: { collectiveSlug, parentCollectiveSlug } }) {
    return { collectiveSlug, parentCollectiveSlug };
  }

  static propTypes = {
    /** @ignore from getInitialProps */
    collectiveSlug: PropTypes.string.isRequired,
    /** @ignore from getInitialProps */
    parentCollectiveSlug: PropTypes.string.isRequired,
    /** @ignore from withUser */
    LoggedInUser: PropTypes.object,
    /** @ignore from withUser */
    loadingLoggedInUser: PropTypes.bool,
    /** @ignore from withRouter */
    router: PropTypes.object,
    /** @ignore from apollo */
    data: PropTypes.shape({
      loading: PropTypes.bool,
      error: PropTypes.any,
      account: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        description: PropTypes.string,
        type: PropTypes.string.isRequired,
        twitterHandle: PropTypes.string,
        imageUrl: PropTypes.string,
      }),
    }).isRequired, // from withData
  };

  getPageMetaData(collective) {
    if (collective) {
      return { title: `${collective.name} - New expense` };
    } else {
      return { title: `New expense` };
    }
  }

  onCreateSuccess = async expense => {
    const { collectiveSlug, parentCollectiveSlug } = this.props;
    await Router.pushRoute('expense', { collectiveSlug, parentCollectiveSlug, ExpenseId: expense.id });
  };

  getSuggestedTags(collective) {
    // TODO - Fetch from the collective most used tags
  }

  render() {
    const { collectiveSlug, data, LoggedInUser, loadingLoggedInUser, router } = this.props;

    if (!data.loading) {
      if (!data || data.error) {
        return <ErrorPage data={data} />;
      } else if (!data.account) {
        ssrNotFoundError(); // Force 404 when rendered server side
        return <ErrorPage error={generateError.notFound(collectiveSlug)} log={false} />;
      } else if (!hasFeature(data.account, FEATURES.CONVERSATIONS)) {
        return <PageFeatureNotSupported />;
      }
    }

    const collective = data && data.account;
    return (
      <Page collective={collective} {...this.getPageMetaData(collective)} withoutGlobalStyles>
        {data.loading ? (
          <Container borderTop="1px solid #E8E9EB">
            <Loading />
          </Container>
        ) : (
          <CollectiveThemeProvider collective={collective}>
            <CollectiveNavbar collective={collective} selected={Sections.CONVERSATIONS} />
            <Container position="relative">
              {!loadingLoggedInUser && !LoggedInUser && (
                <ContainerOverlay>
                  <SignInOrJoinFree routes={{ join: `/create-account?next=${encodeURIComponent(router.asPath)}` }} />
                </ContainerOverlay>
              )}
              <Box maxWidth={1160} m="0 auto" px={[2, 3, 4]} py={[4, 5]}>
                <StyledLink as={Link} color="black.600" route="conversations" params={{ collectiveSlug }}>
                  &larr; <FormattedMessage id="Conversations.GoBack" defaultMessage="Back to conversations" />
                </StyledLink>
                <Flex>
                  <Box mt={4}>
                    <CreateExpenseForm
                      collective={collective}
                      loading={loadingLoggedInUser}
                      onSuccess={this.onCreateSuccess}
                      suggestedTags={this.getSuggestedTags(collective)}
                    />
                  </Box>
                </Flex>
              </Box>
            </Container>
          </CollectiveThemeProvider>
        )}
      </Page>
    );
  }
}

const getData = graphql(
  gqlV2`
    query CreateExpense($collectiveSlug: String!) {
      collective(slug: $collectiveSlug, throwIfMissing: false) {
        id
        slug
        name
        type
        description
        settings
        imageUrl
        twitterHandle
        balance
        currency
      }
    }
  `,
  {
    options: {
      context: API_V2_CONTEXT,
    },
  },
);

export default withUser(getData(withRouter(CreateExpensePage)));
