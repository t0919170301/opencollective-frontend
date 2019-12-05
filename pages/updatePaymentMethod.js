import React from 'react';
import PropTypes from 'prop-types';
import gql from 'graphql-tag';
import styled from 'styled-components';
import { graphql } from 'react-apollo';
import { fontSize, maxWidth } from 'styled-system';
import { Flex, Box } from '@rebass/grid';
import { FormattedMessage, injectIntl } from 'react-intl';
import { get, cloneDeep } from 'lodash';

import { withUser } from '../components/UserProvider';
import Header from '../components/Header';
import Body from '../components/Body';
import Footer from '../components/Footer';
import Container from '../components/Container';
import { H1, H5 } from '../components/Text';
import NewCreditCardForm from '../components/NewCreditCardForm';
import Loading from '../components/Loading';

import { getStripe, stripeTokenToPaymentMethod } from '../lib/stripe';

import { compose } from '../lib/utils';
import { withStripeLoader } from '../components/StripeProvider';

import { getSubscriptionsQuery } from '../lib/graphql/queries';

import StyledButton from '../components/StyledButton';
import RedeemBackground from '../components/virtual-cards/RedeemBackground';

const ShadowBox = styled(Box)`
  box-shadow: 0px 8px 16px rgba(20, 20, 20, 0.12);
`;

const Subtitle = styled(H5)`
  color: white;
  text-align: center;
  margin: 0 auto;
  ${fontSize};
  ${maxWidth};
`;

class UpdatePaymentPage extends React.Component {
  static getInitialProps({ query: { collectiveSlug, id } }) {
    return { slug: collectiveSlug, id: id };
  }

  static propTypes = {
    collective: PropTypes.object,
    slug: PropTypes.string,
    id: PropTypes.number,
    LoggedInUser: PropTypes.object,
    data: PropTypes.object.isRequired,
    subscriptions: PropTypes.array,
    intl: PropTypes.object.isRequired,
    replaceCreditCard: PropTypes.func.isRequired,
    loadStripe: PropTypes.func.isRequired,
  };

  state = {
    showCreditCardForm: true,
    newCreditCardInfo: {},
    error: null,
    stripe: null,
    submitting: false,
  };

  componentDidMount() {
    this.props.loadStripe();
  }

  replaceCreditCard = async () => {
    const data = get(this.state, 'newCreditCardInfo.value');

    if (!data || !this.state.stripe) {
      this.setState({ error: 'There was a problem initializing the payment form' });
    } else if (data.error) {
      this.setState({ error: data.error.message });
    } else {
      try {
        this.setState({ submitting: true });
        const { token, error } = await this.state.stripe.createToken();
        if (error) {
          this.setState({ error: 'There was a problem with Stripe.' });
          throw error;
        }
        const paymentMethod = stripeTokenToPaymentMethod(token);
        const res = await this.props.replaceCreditCard({
          CollectiveId: this.props.LoggedInUser.collective.id,
          ...paymentMethod,
          id: parseInt(this.props.id),
        });
        const updatedCreditCard = res.data.replaceCreditCard;

        if (updatedCreditCard.stripeError) {
          this.handleStripeError(updatedCreditCard.stripeError);
        } else {
          this.handleSuccess();
        }
      } catch (e) {
        this.setState({ error: 'There was an issue updating your card details.', submitting: false });
      }
    }
  };

  handleSuccess = () => {
    this.props.data.refetch();
    this.setState({
      showCreditCardForm: false,
      showManualPaymentMethodForm: false,
      error: null,
      newCreditCardInfo: null,
      submitting: false,
    });
  };

  handleStripeError = async ({ message, response }) => {
    if (!response) {
      this.setState({ error: message, submitting: false });
      return;
    }

    if (response.setupIntent) {
      const stripe = await getStripe();
      const result = await stripe.handleCardSetup(response.setupIntent.client_secret);
      if (result.error) {
        this.setState({ submitting: false, error: result.error.message });
      }
      if (result.setupIntent && result.setupIntent.status === 'succeeded') {
        this.handleSuccess();
      }
    }
  };

  showError = error => {
    this.setState({ error });
    window.scrollTo(0, 0);
  };

  render() {
    const { showCreditCardForm, submitting } = this.state;
    const { LoggedInUser } = this.props;
    const { loading } = this.props.data;

    const subs = [];
    this.props.subscriptions.forEach(sub => {
      subs.push(sub.collective.name);
    });

    return loading ? (
      <Loading />
    ) : (
      <div className="UpdatedPaymentMethodPage">
        <Header
          title="Update Payment Method"
          description="Update the payment method attached to your recurring subscriptions."
          LoggedInUser={LoggedInUser}
        />
        <Body>
          <Flex alignItems="center" flexDirection="column">
            <RedeemBackground>
              <Box mt={5}>
                <H1 color="white.full" fontSize={['3rem', null, '4rem']}>
                  <FormattedMessage id="updatePaymentMethod.title" defaultMessage="Update Payment Method" />
                </H1>
              </Box>

              <Box mt={2}>
                <Subtitle fontSize={['1.5rem', null, '2rem']} maxWidth={['90%', '640px']}>
                  <Box>
                    <FormattedMessage
                      id="updatePaymentMethod.subtitle.line"
                      defaultMessage="Add a new payment method for your recurring subscriptions ({subs}) before your current one expires."
                      values={{ subs: `${subs}` }}
                    />
                  </Box>
                </Subtitle>
              </Box>
            </RedeemBackground>
            <Flex alignItems="center" flexDirection="column" mt={-175} mb={4}>
              <Container mt={54} zIndex={2}>
                <Flex justifyContent="center" alignItems="center" flexDirection="column">
                  <Container background="white" borderRadius="16px" maxWidth="600px">
                    <ShadowBox py="24px" px="32px" minWidth="500px">
                      {showCreditCardForm && (
                        <Box mr={2} css={{ flexGrow: 1 }}>
                          <NewCreditCardForm
                            name="newCreditCardInfo"
                            profileType={get(this.props.collective, 'type')}
                            hasSaveCheckBox={false}
                            // error={errors.newCreditCardInfo}
                            onChange={newCreditCardInfo => this.setState({ newCreditCardInfo, error: null })}
                            onReady={({ stripe }) => this.setState({ stripe })}
                          />
                        </Box>
                      )}
                      {!showCreditCardForm && (
                        <FormattedMessage id="success" defaultMessage="Your new card info has been added" />
                      )}
                    </ShadowBox>
                  </Container>
                  <Flex my={4} px={2} flexDirection="column" alignItems="center">
                    {showCreditCardForm && (
                      <StyledButton
                        buttonStyle="primary"
                        buttonSize="large"
                        mb={2}
                        maxWidth={335}
                        width={1}
                        type="submit"
                        onClick={this.replaceCreditCard}
                        disabled={submitting}
                        loading={submitting}
                        textTransform="capitalize"
                      >
                        <FormattedMessage
                          id="updatePaymentMethod.form.updatePaymentMethod.btn"
                          defaultMessage="update"
                        />
                      </StyledButton>
                    )}
                    {!showCreditCardForm && (
                      <StyledButton
                        buttonStyle="primary"
                        buttonSize="large"
                        mb={2}
                        maxWidth={335}
                        width={1}
                        disabled={true}
                        textTransform="capitalize"
                      >
                        <FormattedMessage
                          id="updatePaymentMethod.form.updatePaymentMethodSuccess.btn"
                          defaultMessage="Updated"
                        />
                      </StyledButton>
                    )}
                  </Flex>
                </Flex>
              </Container>
            </Flex>
          </Flex>
        </Body>
        <Footer />
      </div>
    );
  }
}

export const replaceCreditCard = graphql(
  gql`
    mutation replaceCreditCard(
      $id: Int!
      $CollectiveId: Int!
      $name: String!
      $token: String!
      $data: StripeCreditCardDataInputType!
    ) {
      replaceCreditCard(CollectiveId: $CollectiveId, name: $name, token: $token, data: $data, id: $id) {
        id
        data
        createdAt
      }
    }
  `,
  {
    props: ({ mutate }) => ({
      replaceCreditCard: variables => mutate({ variables }),
    }),
  },
);

const addSubscriptionsData = graphql(getSubscriptionsQuery, {
  options(props) {
    return {
      variables: {
        slug: props.slug,
      },
    };
  },

  props: ({ data }) => {
    let allSubs = [];
    let subscriptions = [];

    if (data && data.Collective) {
      allSubs = cloneDeep(data.Collective.ordersFromCollective);
      subscriptions = allSubs.filter(sub => sub.isSubscriptionActive === true);
    }

    return {
      data,
      subscriptions,
    };
  },
});

const addData = compose(addSubscriptionsData, replaceCreditCard);

export default injectIntl(addData(withUser(withStripeLoader(UpdatePaymentPage))));
